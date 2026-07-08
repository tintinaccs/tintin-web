# Tintin — Publicación de reglas Firebase

Este proyecto ya tiene configurado Firebase para publicar reglas de Firestore.

## Proyecto Firebase

El proyecto predeterminado está definido en `.firebaserc`:

```json
{
  "projects": {
    "default": "tintin-accesorios"
  }
}
```

## Qué archivo se publica

`firebase.json` apunta a:

```json
{
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

## Publicar SOLO reglas de Firestore

Usar este comando desde la raíz del repo:

```bash
npm run deploy:rules
```

Ese comando ejecuta:

```bash
firebase deploy --only firestore:rules --project tintin-accesorios
```

## Recomendación

Después de tocar `firestore.rules`, publicar solo reglas primero. No hace falta publicar hosting ni functions si solo se cambió seguridad.

## Recordatorio importante

Los cambios en `firestore.rules` dentro de GitHub no protegen la base de datos hasta que se publican en Firebase.
