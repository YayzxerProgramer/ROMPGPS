package com.servidortpc.servidor_tpc.netty;

import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;

public class GT06Utils {

    public static String decodificarIMEI(byte[] bytes) {
        StringBuilder imei = new StringBuilder();
        for (byte b : bytes) {
            imei.append((b >> 4) & 0x0F);
            imei.append(b & 0x0F);
        }
        return imei.toString();
    }

    public static int calcularCRC(byte[] data) {
        int crc = 0xFFFF;
        for (byte b : data) {
            crc ^= (b & 0xFF);
            for (int i = 0; i < 8; i++) {
                if ((crc & 1) != 0) {
                    crc = (crc >> 1) ^ 0x8408;
                } else {
                    crc >>= 1;
                }
            }
        }
        crc = ~crc;
        return crc & 0xFFFF;
    }

    // construir ACK LOGIN (Respuesta de confirmacion de login)
    public static ByteBuf ACK(short serial) {

        ByteBuf paquete = Unpooled.buffer();

        paquete.writeByte(0x78); // Primer byte
        paquete.writeByte(0x78); // Segundo byte
        paquete.writeByte(0x5); // Longitud del paquete (5 bytes)
        paquete.writeByte(0x1); // Protocolo (ACK de login)
        paquete.writeShort(serial); // Numero de serie (2 bytes)

        // CRC se calcula sobre: Length + Protocol + Serial
        byte[] crcData = {
            0x05,
            0x01,
            (byte) (serial >> 8),
            (byte) (serial & 0xFF)
        };

        int crc = calcularCRC(crcData);

        // GT06 usa Big-Endian (Network Byte Order) para el CRC
        paquete.writeShort(crc);

        paquete.writeByte(0x0D);
        paquete.writeByte(0x0A);

        return paquete;
    }

    public static ByteBuf ACKHeartbeat(short serial) {

        ByteBuf buffer = Unpooled.buffer();

        buffer.writeByte(0x78);
        buffer.writeByte(0x78);

        buffer.writeByte(0x05);      // longitud
        buffer.writeByte(0x13);      // protocolo heartbeat

        buffer.writeShort(serial);   // serial recibido

        byte[] datos = new byte[buffer.readableBytes() - 2];
        buffer.getBytes(2, datos);

        int crc = calcularCRC(datos);

        // GT06 usa Big-Endian (Network Byte Order) para el CRC
        buffer.writeShort(crc);

        buffer.writeByte(0x0D);
        buffer.writeByte(0x0A);

        return buffer;
    }

}
