package com.servidortpc.servidor_tpc.netty;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import io.netty.bootstrap.ServerBootstrap;
import io.netty.buffer.PooledByteBufAllocator;
import io.netty.channel.ChannelOption;
import io.netty.channel.EventLoopGroup;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

/**
 * Servidor TCP para los dispositivos GT06.
 *
 * El puerto pasa a ser configurable (gps.tcp.puerto). Estaba escrito a mano
 * como 9000, y el Dockerfile del módulo expone el 8080 —el HTTP— pero NO el
 * 9000, que es por donde entran los GPS de verdad.
 *
 * Se inyecta GpsInitializer como bean en lugar de construirlo a mano: antes
 * existían dos instancias, la del contenedor de Spring y la creada con new, y
 * la del contenedor no se usaba para nada.
 */
@Component
public class ServerTcp {

    private static final Logger log = LoggerFactory.getLogger(ServerTcp.class);

    private final GpsInitializer gpsInitializer;

    private EventLoopGroup aceptarConexiones;
    private EventLoopGroup procesarDatos;

    @Value("${gps.tcp.puerto:9000}")
    private int puerto;

    public ServerTcp(GpsInitializer gpsInitializer) {
        this.gpsInitializer = gpsInitializer;
    }

    @PostConstruct
    public void iniciarServidor() throws InterruptedException {
        aceptarConexiones = new NioEventLoopGroup(1);
        procesarDatos = new NioEventLoopGroup();

        new ServerBootstrap()
                .group(aceptarConexiones, procesarDatos)
                .channel(NioServerSocketChannel.class)
                // Cola de espera de conexiones entrantes para ráfagas concurrentes.
                .option(ChannelOption.SO_BACKLOG, 1024)
                // Reutilizar la dirección evita el "Address already in use" al
                // reiniciar mientras quedan sockets en TIME_WAIT.
                .option(ChannelOption.SO_REUSEADDR, true)
                // Los GT06 mandan tramas pequeñas: sin esto, Nagle las retiene.
                .childOption(ChannelOption.TCP_NODELAY, true)
                .childOption(ChannelOption.SO_KEEPALIVE, true)
                // Buffer pooling nativo: cero pausas de Garbage Collector (GC).
                .childOption(ChannelOption.ALLOCATOR, PooledByteBufAllocator.DEFAULT)
                .childOption(ChannelOption.SO_RCVBUF, 32 * 1024)
                .childOption(ChannelOption.SO_SNDBUF, 32 * 1024)
                .childHandler(gpsInitializer)
                .bind(puerto)
                .sync();

        log.info("Servidor TCP GT06 escuchando en el puerto {}", puerto);
    }

    @PreDestroy
    public void cerrarServidor() {
        log.info("Cerrando el servidor TCP");
        if (aceptarConexiones != null) {
            aceptarConexiones.shutdownGracefully();
        }
        if (procesarDatos != null) {
            procesarDatos.shutdownGracefully();
        }
    }
}
