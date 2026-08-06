# Project conventions

- Do not use Java records. Use regular classes with Lombok to generate boilerplate such as getters, constructors, builders, `equals`, and `hashCode` as appropriate.
- Global application properties sourced from environment variables must live in `com.vastbricks.config.Env`; do not create separate global properties classes.
