package com.gpsromp.gps.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import com.gpsromp.gps.model.DispositivoGps;

@Repository
public interface DispositivoGpsRepository extends MongoRepository<DispositivoGps, String> {

    Optional<DispositivoGps> findByImei(String imei);

    boolean existsByImei(String imei);

    List<DispositivoGps> findAllByImeiIn(Collection<String> imeis);

    Optional<DispositivoGps> findByNumeroSim(String numeroSim);
}
