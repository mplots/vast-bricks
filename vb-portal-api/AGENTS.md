# Project conventions

- Do not use Java records. Use regular classes with Lombok to generate boilerplate such as getters, constructors, builders, `equals`, and `hashCode` as appropriate.
- For Spring controllers, services, repositories, and configuration classes, prefer final dependencies with Lombok `@RequiredArgsConstructor` over handwritten dependency-injection constructors. Write an explicit constructor only when it contains real custom initialization logic.
- Global application properties sourced from environment variables must live in `com.vastbricks.config.Env`; do not create separate global properties classes.
