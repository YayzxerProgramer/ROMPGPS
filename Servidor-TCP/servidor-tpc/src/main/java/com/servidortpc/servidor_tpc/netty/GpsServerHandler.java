package com.servidortpc.servidor_tpc.netty;

import java.nio.ByteBuffer;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.servidortpc.servidor_tpc.Model.GPSData;
import com.servidortpc.servidor_tpc.Service.GpsDataService;
import com.servidortpc.servidor_tpc.Service.PublicadorBackend;

import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.SimpleChannelInboundHandler;
import io.netty.handler.timeout.IdleStateEvent;

/**
 * Interpreta las tramas GT06 ya desencuadradas por DecodificadorTramaGt06.
 *
 * CAMBIOS RESPECTO A LA VERSIÓN ANTERIOR:
 *
 *  - Ya NO es @Component ni @Sharable. Tenía campos mutables (imei, accOn) en
 *    un bean marcado como compartible: funcionaba de casualidad porque el
 *    initializer creaba una instancia por canal e ignoraba el singleton de
 *    Spring. Si alguien "arreglaba" el pipeline para inyectar el bean, todos
 *    los GPS habrían compartido el mismo IMEI. Ahora se crea explícitamente
 *    una instancia por conexión y eso queda documentado.
 *
 *  - El envío al backend ya no bloquea el event loop. Antes se llamaba a
 *    restTemplate.postForEntity() dentro del hilo NioEventLoopGroup y sin
 *    timeouts, así que un backend lento congelaba el hilo de I/O y con él a
 *    todos los GPS asignados a ese loop.
 *
 *  - Se envía la hora real del dispositivo, no la de ingesta.
 *
 *  - SLF4J en lugar de System.out, y sin volcar el IMEI completo en cada línea.
 */
public class GpsServerHandler extends SimpleChannelInboundHandler<TramaGt06> {

    private static final Logger log = LoggerFactory.getLogger(GpsServerHandler.class);

    private static final byte PROTO_LOGIN = 0x01;
    private static final byte PROTO_UBICACION = 0x12;
    private static final byte PROTO_HEARTBEAT = 0x13;
    private static final byte PROTO_ESTADO = 0x16;

    private final GpsDataService gpsDataService;
    private final PublicadorBackend publicador;

    /** Estado de ESTA conexión. Una instancia por canal: nunca se comparte. */
    private String imei;
    private boolean accEncendido = false;
    private boolean corteMotor = false;

    public GpsServerHandler(GpsDataService gpsDataService, PublicadorBackend publicador) {
        this.gpsDataService = gpsDataService;
        this.publicador = publicador;
    }

    @Override
    protected void channelRead0(ChannelHandlerContext contexto, TramaGt06 trama) {

        if (!trama.crcValido()) {
            log.warn("Trama descartada por CRC: protocolo {}, recibido {} calculado {}",
                    hex(trama.protocolo()), trama.crcRecibido(), trama.crcCalculado());
            return;
        }

        switch (trama.protocolo()) {
            case PROTO_LOGIN:
                login(contexto, trama);
                break;
            case PROTO_UBICACION:
                ubicacion(trama);
                break;
            case PROTO_HEARTBEAT:
                heartbeat(contexto, trama);
                break;
            case PROTO_ESTADO:
                log.info("Trama de estado (0x16) recibida de {}", imeiCorto());
                break;
            default:
                log.warn("Protocolo no soportado: {} de {}", hex(trama.protocolo()), imeiCorto());
                break;
        }
    }

    // ------------------------------------------------------------- 0x01 login

    private void login(ChannelHandlerContext contexto, TramaGt06 trama) {
        byte[] datos = trama.datos();

        if (datos.length < 8) {
            log.warn("Trama de login demasiado corta: {} bytes", datos.length);
            return;
        }

        byte[] imeiBytes = new byte[8];
        System.arraycopy(datos, 0, imeiBytes, 0, 8);
        this.imei = GT06Utils.decodificarIMEI(imeiBytes);

        log.info("Login del dispositivo {} desde {}", imeiCorto(), contexto.channel().remoteAddress());

        contexto.writeAndFlush(GT06Utils.ACK(trama.serial()));
    }

    // --------------------------------------------------------- 0x12 ubicación

    private void ubicacion(TramaGt06 trama) {

        if (imei == null) {
            // Sin login previo no se sabe de quién es la posición.
            log.warn("Ubicación recibida antes del login. Se descarta.");
            return;
        }

        byte[] datos = trama.datos();
        if (datos.length < 18) {
            log.warn("Trama de ubicación demasiado corta: {} bytes", datos.length);
            return;
        }

        ByteBuffer bb = ByteBuffer.wrap(datos);

        int anio = 2000 + (bb.get() & 0xFF);
        int mes = bb.get() & 0xFF;
        int dia = bb.get() & 0xFF;
        int hora = bb.get() & 0xFF;
        int minuto = bb.get() & 0xFF;
        int segundo = bb.get() & 0xFF;

        bb.get(); // cantidad de satélites y longitud de la información GPS

        int latitudCruda = bb.getInt();
        int longitudCruda = bb.getInt();
        int velocidad = bb.get() & 0xFF;
        int rumboEstado = bb.getShort() & 0xFFFF;

        double latitud = latitudCruda / 1800000.0;
        double longitud = longitudCruda / 1800000.0;

        boolean gpsValido = (rumboEstado & 0x1000) != 0;
        boolean sur = (rumboEstado & 0x0400) == 0;
        boolean oeste = (rumboEstado & 0x0800) != 0;

        if (sur) {
            latitud = -latitud;
        }
        if (oeste) {
            longitud = -longitud;
        }

        // El dispositivo reporta en UTC.
        var instante = seguro(anio, mes, dia, hora, minuto, segundo);

        GPSData gps = new GPSData(imei, instante, latitud, longitud,
                velocidad, gpsValido, accEncendido, corteMotor);

        log.info("Posición de {}: {},{} a {} km/h (GPS {})",
                imeiCorto(), latitud, longitud, velocidad, gpsValido ? "válido" : "inválido");

        gpsDataService.recibirData(gps);

        // Asíncrono y con reintentos: no bloquea el event loop de Netty.
        publicador.publicar(gps);
    }

    // -------------------------------------------------------- 0x13 heartbeat

    /**
     * Trama de heartbeat: terminalInfo(1) + voltaje(1) + señalGsm(1) +
     * alarma/idioma(2) + serial(2).
     *
     * La versión anterior leía terminalInfo, luego un byte que etiquetaba como
     * "nivelGsm" pero que en realidad es el VOLTAJE, y después tomaba como
     * serial los bytes [señalGsm, alarmaAlta]: el ACK devolvía un serial
     * inventado. Ahora el serial se lee por posición desde el final de la trama.
     */
    private void heartbeat(ChannelHandlerContext contexto, TramaGt06 trama) {
        byte[] datos = trama.datos();

        if (datos.length >= 1) {
            byte terminalInfo = datos[0];
            accEncendido = (terminalInfo & 0x02) != 0;
            corteMotor = (terminalInfo & 0x80) != 0;
        }

        if (datos.length >= 3) {
            log.info("Heartbeat de {}: voltaje {}, señal GSM {}",
                    imeiCorto(), datos[1] & 0xFF, datos[2] & 0xFF);
        }

        contexto.writeAndFlush(GT06Utils.ACKHeartbeat(trama.serial()));
    }

    // ------------------------------------------------------- ciclo del canal

    @Override
    public void channelActive(ChannelHandlerContext contexto) {
        log.info("Dispositivo conectado desde {}", contexto.channel().remoteAddress());
    }

    @Override
    public void channelInactive(ChannelHandlerContext contexto) {
        log.info("Dispositivo desconectado: {}", imeiCorto());
    }

    /**
     * Cierra las conexiones mudas.
     * Sin esto, las conexiones GPRS que mueren sin FIN quedaban colgadas hasta
     * el timeout del sistema operativo, acumulando canales abiertos.
     */
    @Override
    public void userEventTriggered(ChannelHandlerContext contexto, Object evento) {
        if (evento instanceof IdleStateEvent) {
            log.info("Sin datos de {} durante el tiempo límite. Se cierra la conexión.", imeiCorto());
            contexto.close();
        }
    }

    @Override
    public void exceptionCaught(ChannelHandlerContext contexto, Throwable causa) {
        log.error("Error en la conexión de {}: {}", imeiCorto(), causa.toString());
        contexto.close();
    }

    // --------------------------------------------------------------- apoyo

    /** Convierte la fecha del dispositivo, tolerando valores fuera de rango. */
    private java.time.Instant seguro(int anio, int mes, int dia, int hora, int minuto, int segundo) {
        try {
            return LocalDateTime.of(anio, mes, dia, hora, minuto, segundo).toInstant(ZoneOffset.UTC);
        } catch (Exception e) {
            log.warn("Fecha inválida del dispositivo {} ({}-{}-{} {}:{}:{}). Se usa la hora actual.",
                    imeiCorto(), anio, mes, dia, hora, minuto, segundo);
            return java.time.Instant.now();
        }
    }

    /** Solo los últimos 6 dígitos: el IMEI completo no debe acabar en los logs. */
    private String imeiCorto() {
        if (imei == null) {
            return "sin-identificar";
        }
        return imei.length() <= 6 ? imei : "..." + imei.substring(imei.length() - 6);
    }

    private String hex(byte b) {
        return String.format("0x%02X", b);
    }
}
