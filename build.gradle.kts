plugins {
    java
    id("org.gradle.toolchains.foojay-resolver-convention") version "0.8.0"
}

group = "com.pruner"
version = "1.0.0"

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(17))
    }
}

repositories {
    mavenCentral()
}

dependencies {
    testImplementation("junit:junit:4.13.2")
}

tasks.test {
    useJUnit()
}
