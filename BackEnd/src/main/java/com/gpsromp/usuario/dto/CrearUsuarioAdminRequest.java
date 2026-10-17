package com.gpsromp.usuario.dto;

import com.gpsromp.usuario.model.Rol;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Alta de usuario desde el panel administrativo (POST /admin/usuarios).
 *
 * A diferencia de RegistroRequest, este DTO SÍ acepta rol y activo, porque quien
 * llama ya pasó por @PreAuthorize("hasRole('ADMIN')"). Es la única vía legítima
 * para crear un usuario con un rol distinto de USER.
 */
public record CrearUsuarioAdminRequest(

        @NotBlank(message = "El nombre es obligatorio")
        @Size(max = 60, message = "El nombre no puede superar 60 caracteres")
        String nombre,

        @Size(max = 60, message = "El apellido no puede superar 60 caracteres")
        String apellido,

        @NotBlank(message = "El nombre de usuario es obligatorio")
        @Size(min = 3, max = 30, message = "El usuario debe tener entre 3 y 30 caracteres")
        @Pattern(regexp = "^[a-zA-Z0-9._-]+$",
                 message = "El usuario solo admite letras, números, punto, guion y guion bajo")
        String usuario,

        @NotBlank(message = "La contraseña es obligatoria")
        @Size(min = 8, max = 72, message = "La contraseña debe tener entre 8 y 72 caracteres")
        String contrasena,

        @NotBlank(message = "El correo es obligatorio")
        @Email(message = "El correo no tiene un formato válido")
        @Size(max = 120, message = "El correo no puede superar 120 caracteres")
        String correo,

        @Pattern(regexp = "^$|^[0-9+()\\s-]{7,20}$", message = "El teléfono no tiene un formato válido")
        String telefono,

        @NotNull(message = "El rol es obligatorio")
        Rol rol,

        com.gpsromp.usuario.model.PlanTipo plan,

        Boolean activo,

        @Size(max = 500, message = "La URL de imagen no puede superar 500 caracteres")
        String imagenUrl) {
}
