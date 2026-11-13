package com.gpsromp.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Habilita la ejecución de tareas programadas en segundo plano (@Scheduled)
 * para el monitoreo de alertas telemáticas y vencimiento de documentos.
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
