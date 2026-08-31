package com.vastbricks.api.auth;

import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
class UserRepository {

    private static final String USER_COLUMNS = "id, email, password_hash, name, role, active, created_at";

    private final JdbcTemplate jdbcTemplate;

    @Value("${VAST_DB_SCHEMA:vast}")
    private String schema = "vast";

    Optional<User> findByEmail(String email) {
        return jdbcTemplate.query(
                        "SELECT " + USER_COLUMNS + " FROM " + usersTable() + " WHERE email = ?",
                        (resultSet, rowNumber) -> new User(
                                resultSet.getLong("id"),
                                resultSet.getString("email"),
                                resultSet.getString("password_hash"),
                                resultSet.getString("name"),
                                resultSet.getString("role"),
                                resultSet.getBoolean("active"),
                                resultSet.getTimestamp("created_at").toInstant()),
                        email)
                .stream()
                .findFirst();
    }

    Optional<User> findById(Long id) {
        return jdbcTemplate.query(
                        "SELECT " + USER_COLUMNS + " FROM " + usersTable() + " WHERE id = ?",
                        (resultSet, rowNumber) -> new User(
                                resultSet.getLong("id"),
                                resultSet.getString("email"),
                                resultSet.getString("password_hash"),
                                resultSet.getString("name"),
                                resultSet.getString("role"),
                                resultSet.getBoolean("active"),
                                resultSet.getTimestamp("created_at").toInstant()),
                        id)
                .stream()
                .findFirst();
    }

    private String usersTable() {
        if (!schema.matches("[A-Za-z_][A-Za-z0-9_]*")) {
            throw new IllegalStateException("VAST_DB_SCHEMA must be a PostgreSQL identifier");
        }
        return '\"' + schema + "\".users";
    }
}
