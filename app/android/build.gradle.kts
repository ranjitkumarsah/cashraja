allprojects {
    repositories {
        google()
        mavenCentral()
        // FingerprintJS Pro Android — a transitive dependency of the PlaytimeAds
        // offerwall SDK (com.fingerprint.android:pro), hosted on their own maven.
        maven { url = uri("https://maven.fpregistry.io/releases") }
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
