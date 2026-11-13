package com.gpsromp.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.CacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.serializer.*;

import com.gpsromp.gps.service.ReceptorGpsRedis;

import java.time.Duration;

/**
 * Configuración de Redis.
 *
 * ARREGLO DE LA SERIALIZACIÓN:
 *
 * El CacheManager usaba Jackson2JsonRedisSerializer<>(mapper, Object.class) con
 * un ObjectMapper sin información de tipos. Al deserializar no había forma de
 * saber la clase original, así que en un cache-hit una List<Usuario> volvía
 * como List<LinkedHashMap> disfrazada y el primer acceso tipado lanzaba
 * ClassCastException. Ahora se usa GenericJackson2JsonRedisSerializer, que
 * incluye el tipo en el propio JSON — es lo que ya hacía el RedisTemplate de
 * GPS, y por eso ese sí funcionaba.
 *
 * ADVERTENCIA SOBRE EL MÉTODO QUE SE ELIMINÓ:
 *
 * Existía un objectMapper() privado que nadie llamaba y que activaba
 * activateDefaultTyping(..., NON_FINAL). Parecía "el arreglo evidente", pero
 * conectarlo habría abierto deserialización polimórfica sobre datos de Redis,
 * es decir, ejecución remota de código a través de una gadget chain si alguien
 * conseguía escribir en la caché. Se borra para que nadie lo cablee por error.
 * GenericJackson2JsonRedisSerializer resuelve el problema real sin ese riesgo.
 */
@Configuration
public class RedisConfig {

    /** ObjectMapper común: fechas ISO-8601, no marcas de tiempo numéricas. */
    private ObjectMapper construirMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        return mapper;
    }

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);

        GenericJackson2JsonRedisSerializer valueSerializer =
                new GenericJackson2JsonRedisSerializer(construirMapper());

        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(valueSerializer);
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(valueSerializer);

        template.afterPropertiesSet();
        return template;
    }

    /**
     * Plantilla de solo cadenas, para los tokens de refresco y los contadores
     * de intentos: ahí no hay objetos que serializar y el texto plano evita
     * cualquier ambigüedad de tipos.
     */
    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory connectionFactory) {
        return new StringRedisTemplate(connectionFactory);
    }

    @Bean
    public CacheManager cacheManager(RedisConnectionFactory connectionFactory) {

        GenericJackson2JsonRedisSerializer serializer =
                new GenericJackson2JsonRedisSerializer(construirMapper());

        RedisCacheConfiguration configuracion = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(5))
                .serializeKeysWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(serializer))
                // Se mantiene: cachear nulos oculta los 404 y llena Redis de
                // entradas vacías. Los servicios ya no cachean Optional, que era
                // lo que hacía saltar IllegalArgumentException con esta opción.
                .disableCachingNullValues();

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(configuracion)
                .build();
    }

    /**
     * Contenedor de escucha reactivo para eventos GPS desde el Servidor-TCP.
     * Recibe tramas en < 1 ms por Redis Pub/Sub.
     */
    @Bean
    public RedisMessageListenerContainer redisMessageListenerContainer(
            RedisConnectionFactory connectionFactory,
            ReceptorGpsRedis receptorGpsRedis,
            @Value("${gps.redis.canal-posiciones:gps:posiciones}") String canal) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener(receptorGpsRedis, new ChannelTopic(canal));
        return container;
    }
}
