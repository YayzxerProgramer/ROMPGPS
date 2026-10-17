package com.gpsromp.usuario.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Actualización de perfil (PUT /usuario/{id}).
 *
 * Semántica de patch: todo campo null se deja como está. Es la semántica que ya
 * tenía UsuarioService.actualizarUsuario y la que espera PerfilUsuario.jsx.
 *
 * NO incluye rol ni activo a propósito: cambiarlos es una operación de
 * administración y vive en /admin/usuarios/{id}/rol y /admin/usuarios/{id}/estado.
 * PerfilUsuario.jsx los sigue enviando en el body y se ignoran sin romper nada.
 */
public record ActualizarUsuarioRequest(

        @Size(max = 60, message = "El nombre no puede superar 60 caracteres")
        String nombre,

        @Size(max = 60, message = "El apellido no puede superar 60 caracteres")
        String apellido,

        @Size(min = 3, max = 30, message = "El usuario debe tener entre 3 y 30 caracteres")
        @Pattern(regexp = "^[a-zA-Z0-9._-]+$",
                 message = "El usuario solo admite letras, números, punto, guion y guion bajo")
        String usuario,

        @Email(message = "El correo no tiene un formato válido")
        @Size(max = 120, message = "El correo no puede superar 120 caracteres")
        String correo,

        @Pattern(regexp = "^$|^[0-9+()\\s-]{7,20}$", message = "El teléfono no tiene un formato válido")
        String telefono,

        com.gpsromp.usuario.model.PlanTipo plan,

        @Size(max = 500, message = "La URL de imagen no puede superar 500 caracteres")
        String imagenUrl) {
}
