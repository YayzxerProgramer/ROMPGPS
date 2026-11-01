package com.gpsromp.config;

import java.util.List;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Configuración de seguridad.
 *
 * @EnableMethodSecurity ES EL CAMBIO CENTRAL DE ESTA TAREA. Sin esta anotación
 * Spring ignora los @PreAuthorize SIN emitir ningún warning: el código se lee
 * como protegido y está abierto. Todas las reglas por rol de los controladores
 * dependen de que esté aquí.
 *
 * Verificación: autenticarse como USER y llamar a GET /admin/usuarios. Debe
 * responder 403. Si responde 200, esta anotación no está surtiendo efecto.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtFilter jwtFilter;
    private final FiltroApiKeyGps filtroApiKeyGps;
    private final FiltroLimiteIntentos filtroLimiteIntentos;
    private final PuntoEntradaAutenticacion puntoEntradaAutenticacion;
    private final ManejadorAccesoDenegado manejadorAccesoDenegado;

    /**
     * Orígenes permitidos, configurables por entorno.
     * Antes se combinaba addAllowedOrigin("http://localhost:5173") con
     * addAllowedOriginPattern("*") y setAllowCredentials(true): el patrón comodín
     * ganaba y se reflejaba el Origin de cualquier atacante junto a
     * Access-Control-Allow-Credentials, dejando la whitelist como decoración.
     */
    @Value("${cors.origenes-permitidos:http://localhost:5173,http://localhost:3000}")
    private String origenesPermitidos;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(puntoEntradaAutenticacion)
                        .accessDeniedHandler(manejadorAccesoDenegado))
                .authorizeHttpRequests(auth -> auth
                        // Preflight
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // Autenticación y registro público
                                                .requestMatchers(HttpMethod.POST, "/usuario/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/usuario/login/verificar-2fa").permitAll()
                        .requestMatchers(HttpMethod.POST, "/usuario/login/cambiar-canal-2fa").permitAll()
                        .requestMatchers(HttpMethod.POST, "/usuario/recuperar-contrasena/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/usuario/sms/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/usuario/email/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/usuario/google").permitAll()
                        .requestMatchers(HttpMethod.POST, "/usuario/github").permitAll()
                        .requestMatchers(HttpMethod.POST, "/usuario/github/callback").permitAll()
                        .requestMatchers(HttpMethod.POST, "/usuario").permitAll()
                        .requestMatchers(HttpMethod.POST, "/usuario/refrescar").permitAll()
                        .requestMatchers(HttpMethod.POST, "/usuario/logout").permitAll()

                        // Webhook de pagos Wompi
                        .requestMatchers(HttpMethod.POST, "/pagos/wompi/webhook").permitAll()

                        // Comprobación de disponibilidad durante el registro.
                        // Antes exigían token, así que el formulario de registro
                        // (que es público) no podía usarlas.
                        .requestMatchers(HttpMethod.GET, "/usuario/exists/**").permitAll()

                        // Ingesta del Servidor-TCP: no lleva JWT de usuario porque
                        // quien publica es un servicio. La protege FiltroApiKeyGps,
                        // que exige la cabecera X-API-Key antes de llegar aquí.
                        .requestMatchers(HttpMethod.POST, "/gps").permitAll()

                        // Documentación de la API. Se puede apagar por entorno
                        // con SWAGGER_HABILITADO=false en producción.
                        .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll()

                        // Solo health e info; el resto de actuator, autenticado.
                        .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                        .requestMatchers("/actuator/**").hasAnyRole("ADMINISTRADOR", "ADMIN")

                        // El handshake HTTP pasa; la autenticación real la hace
                        // InterceptorAutenticacionStomp sobre el frame CONNECT,
                        // que es donde viaja el token.
                        .requestMatchers("/ws-gps/**").permitAll()

                        // Panel administrativo: barrera a nivel de ruta, además
                        // del @PreAuthorize de cada método. Defensa en profundidad.
                        .requestMatchers("/admin/**").hasAnyRole("ADMINISTRADOR", "ADMIN")

                        .anyRequest().authenticated())
                .addFilterBefore(filtroLimiteIntentos, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(filtroApiKeyGps, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(origenesPermitidos.split(",")));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "Origin"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config)
            throws Exception {
        return config.getAuthenticationManager();
    }
}

