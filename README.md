# Código Secreto - Juego en Tiempo Real

Este proyecto es una implementación del juego de mesa "Código Secreto" (Codenames) utilizando **Next.js**, **Socket.io** y **Bun**.

## Características

- **Salas Privadas:** Crea o únete a salas mediante un código único.
- **Roles:**
  - **Mesa de Juego:** Dispositivo central (tablet/pantalla táctil) donde se muestran las palabras y se seleccionan las cartas.
  - **Jefes de Equipo (Rojo/Azul):** Ven el mapa de colores completo (solución) en sus propios dispositivos.
- **Tiempo Real:** Todas las acciones se sincronizan instantáneamente entre dispositivos.

## Tecnologías

- [Next.js 16](https://nextjs.org/)
- [React 19](https://react.dev/)
- [Socket.io](https://socket.io/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Bun](https://bun.sh/)

## Cómo Ejecutar

Asegúrate de tener **Bun** instalado.

1. **Instalar dependencias:**

```bash
bun install
```

2. **Ejecutar el servidor de desarrollo:**

```bash
bun dev
```

3. **Abrir en el navegador:**

Visita [http://localhost:3000](http://localhost:3000).

## Reglas Básicas

1. Se divide a los jugadores en dos equipos: Rojo y Azul.
2. Un jugador de cada equipo es el "Jefe de Espías" (Spymaster).
3. Los Jefes ven el color de todas las palabras.
4. Los Jefes dan una pista compuesta por **una palabra** y **un número** (ej: "Animales 3").
5. Los jugadores en la "Mesa" intentan adivinar las palabras de su color evitando las del equipo contrario, las neutrales y sobre todo al **ASESINO** (carta negra).
6. Gana el equipo que encuentre todas sus palabras primero.

## Notas Técnicas

- El servidor personalizado (`server.ts`) maneja tanto las peticiones de Next.js como los eventos de WebSocket.
- La persistencia del estado del juego es en memoria (se pierde si se reinicia el servidor).
