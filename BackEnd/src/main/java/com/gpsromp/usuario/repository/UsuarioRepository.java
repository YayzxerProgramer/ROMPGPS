package com.gpsromp.usuario.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.gpsromp.usuario.model.Rol;
import com.gpsromp.usuario.model.Usuario;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, UUID> {

    Optional<Usuario> findByUsuario(String usuario);

    Optional<Usuario> findByUsuarioIgnoreCase(String usuario);

    Optional<Usuario> findByCorreo(String correo);

    Optional<Usuario> findByCorreoIgnoreCase(String correo);

    Optional<Usuario> findByTelefono(String telefono);

    boolean existsByUsuario(String usuario);

    boolean existsByCorreo(String correo);

    boolean existsByTelefono(String telefono);

    /** Para la regla del último ADMIN y para la métrica del panel. */
    long countByRol(Rol rol);

    long countByActivoTrue();

    boolean existsByRol(Rol rol);

    /** ¿Otro usuario distinto de este ya usa ese nombre? Para validar en la actualización. */
    boolean existsByUsuarioAndIdNot(String usuario, UUID id);

    boolean existsByCorreoAndIdNot(String correo, UUID id);

    /**
     * Listado del panel: búsqueda de texto + filtro por rol y estado, paginado.
     *
     * La búsqueda se normaliza a cadena vacía en el servicio, de modo que
     * LIKE '%%' actúa como "sin filtro". Se evita así el problema de Postgres al
     * inferir el tipo de un parámetro null dentro de un LIKE.
     *
     * Sustituye al findAll() sin paginación que traía la tabla entera en cada
     * carga del panel.
     */
    @Query("""
            SELECT u FROM Usuario u
            WHERE (LOWER(u.nombre)   LIKE LOWER(CONCAT('%', :busqueda, '%'))
                OR LOWER(u.apellido) LIKE LOWER(CONCAT('%', :busqueda, '%'))
                OR LOWER(u.usuario)  LIKE LOWER(CONCAT('%', :busqueda, '%'))
                OR LOWER(u.correo)   LIKE LOWER(CONCAT('%', :busqueda, '%')))
              AND (:rol    IS NULL OR u.rol    = :rol)
              AND (:activo IS NULL OR u.activo = :activo)
            """)
    Page<Usuario> buscar(@Param("busqueda") String busqueda,
                         @Param("rol") Rol rol,
                         @Param("activo") Boolean activo,
                         Pageable pageable);
}
