package com.servidortpc.servidor_tpc.netty;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import io.netty.buffer.ByteBuf;

/**
 * Pruebas de la decodificación GT06.
 *
 * Estas funciones son puras y son el corazón del protocolo, pero no tenían ni
 * un solo test: la cobertura del repositorio era cero y los únicos archivos de
 * prueba eran dos contextLoads() vacíos.
 */
class GT06UtilsTest {

    @Test
    @DisplayName("El IMEI se decodifica desde BCD, dos dígitos por byte")
    void decodificaImeiBcd() {
        // 0x08 0x69 0x24 0x70 0x50 0x00 0x12 0x34 -> "0869247050001234"
        byte[] bcd = { 0x08, 0x69, 0x24, 0x70, 0x50, 0x00, 0x12, 0x34 };

        assertEquals("0869247050001234", GT06Utils.decodificarIMEI(bcd));
    }

    @Test
    @DisplayName("Un IMEI con ceros a la izquierda conserva su longitud")
    void conservaCerosIniciales() {
        byte[] bcd = { 0x00, 0x00, 0x24, 0x70, 0x50, 0x00, 0x12, 0x34 };

        String imei = GT06Utils.decodificarIMEI(bcd);

        assertEquals(16, imei.length());
        assertEquals("0000247050001234", imei);
    }

    @Test
    @DisplayName("El CRC-ITU es determinista para la misma entrada")
    void crcDeterminista() {
        byte[] datos = { 0x05, 0x01, 0x00, 0x01 };

        assertEquals(GT06Utils.calcularCRC(datos), GT06Utils.calcularCRC(datos));
    }

    @Test
    @DisplayName("Un solo bit distinto cambia el CRC")
    void crcDetectaCambios() {
        byte[] original = { 0x05, 0x01, 0x00, 0x01 };
        byte[] alterado = { 0x05, 0x01, 0x00, 0x02 };

        assertNotEquals(GT06Utils.calcularCRC(original), GT06Utils.calcularCRC(alterado));
    }

    @Test
    @DisplayName("El CRC siempre cabe en 16 bits")
    void crcEnRango() {
        for (int i = 0; i < 256; i++) {
            int crc = GT06Utils.calcularCRC(new byte[] { (byte) i, 0x12, 0x34 });
            assertEquals(crc, crc & 0xFFFF, "El CRC debe estar entre 0 y 0xFFFF");
        }
    }

    @Test
    @DisplayName("El ACK de login tiene la estructura y el cierre correctos")
    void ackLoginBienFormado() {
        ByteBuf ack = GT06Utils.ACK((short) 0x0001);

        byte[] bytes = new byte[ack.readableBytes()];
        ack.getBytes(0, bytes);

        assertEquals(10, bytes.length, "78 78 LEN PROTO SERIAL(2) CRC(2) 0D 0A");
        assertEquals((byte) 0x78, bytes[0]);
        assertEquals((byte) 0x78, bytes[1]);
        assertEquals((byte) 0x05, bytes[2], "longitud");
        assertEquals((byte) 0x01, bytes[3], "protocolo de login");
        assertEquals((byte) 0x00, bytes[4], "serial alto");
        assertEquals((byte) 0x01, bytes[5], "serial bajo");
        assertEquals((byte) 0xD9, bytes[6], "CRC alto (Big-Endian)");
        assertEquals((byte) 0xDC, bytes[7], "CRC bajo (Big-Endian)");
        assertEquals((byte) 0x0D, bytes[8]);
        assertEquals((byte) 0x0A, bytes[9]);

        ack.release();
    }

    @Test
    @DisplayName("El ACK de login devuelve el serial que llegó")
    void ackDevuelveElSerial() {
        ByteBuf ack = GT06Utils.ACK((short) 0x1234);

        byte[] bytes = new byte[ack.readableBytes()];
        ack.getBytes(0, bytes);

        assertEquals((byte) 0x12, bytes[4]);
        assertEquals((byte) 0x34, bytes[5]);

        ack.release();
    }

    @Test
    @DisplayName("El ACK de heartbeat usa el protocolo 0x13")
    void ackHeartbeatProtocolo() {
        ByteBuf ack = GT06Utils.ACKHeartbeat((short) 0x0007);

        byte[] bytes = new byte[ack.readableBytes()];
        ack.getBytes(0, bytes);

        assertEquals((byte) 0x13, bytes[3]);
        assertEquals((byte) 0x00, bytes[4]);
        assertEquals((byte) 0x07, bytes[5]);

        ack.release();
    }
}
