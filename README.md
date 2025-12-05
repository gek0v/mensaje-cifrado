# Mensaje Cifrado - Juego en Tiempo Real

Este proyecto es una implementación digital avanzada del juego de mesa "Mensaje Cifrado" (inspirado en Codenames), optimizada para jugar con amigos usando múltiples dispositivos. Desarrollado con **Next.js**, **Socket.io** y **Bun**.

🔗 **Juega ahora:** [https://mensaje-cifrado.onrender.com](https://mensaje-cifrado.onrender.com)

## Modos de Juego

### 1. Modo Clásico (Estándar)
La experiencia tradicional de equipos enfrentados.
- **Objetivo:** Dos equipos (Rojo y Azul) compiten por encontrar a todos sus agentes primero.
- **Roles:** Jefes de Espías (dan pistas) y Agentes de Campo (adivinan).
- **Mecánica:** Turnos alternos, evitando las cartas neutrales y al temido **ASESINO**.

### 2. Nuevo: Modo Enlace Neural (Cooperativo / Speedrun)
Un modo frenético contrarreloj diseñado para 2 jugadores o un solo equipo contra el sistema.
- **Objetivo:** Descubrir todos los agentes antes de que se agote el tiempo.
- **Contrarreloj:** Elige partidas de **1:30**, **3:00** o **5:00** minutos.
- **Sistema de Penalizaciones:** 
  - Fallar una carta enemiga (Roja) resta **15 segundos**.
  - El Asesino termina la partida inmediatamente (Victoria del Sistema).
  - Cartas neutrales no penalizan tiempo.
- **Interfaz Exclusiva:** HUD estilo "Matrix/Cyberpunk" con temporizador dinámico y acentos color esmeralda.
- **Jefe Azul:** En este modo, el jugador toma el rol de Jefe Azul (Player) contra el Sistema (Rojo).

## Características Principales

- **Sincronización en Tiempo Real:** WebSockets garantizan que cada movimiento se refleje instantáneamente en todos los dispositivos.
- **Salas Privadas:** Sistema de códigos de 4 letras para crear partidas exclusivas.
- **Roles Dinámicos:**
  - **Mesa de Juego:** Pantalla principal para mostrar a todos los jugadores.
  - **Jefe de Espías:** Interfaz privada con la solución del tablero.
- **Diseño Cyberpunk/Neon:** Estética moderna con efectos de brillo y animaciones fluidas.
- **Base de Datos de Palabras:** Más de 1000 palabras incluyendo objetos, marcas, lugares, comidas y conceptos abstractos.

## Tecnologías

- [Next.js 16](https://nextjs.org/) - Framework React de última generación.
- [Socket.io](https://socket.io/) - Comunicación bidireccional en tiempo real.
- [Tailwind CSS v4](https://tailwindcss.com/) - Estilizado rápido y eficiente.
- [Bun](https://bun.sh/) - Runtime de JavaScript ultrarrápido.

## Instalación y Ejecución Local

Requisitos: Tener **Bun** instalado.

1. **Clonar el repositorio e instalar dependencias:**
```bash
git clone https://github.com/gek0v/codigo-secreto-next.git
cd codigo-secreto-next
bun install
```

2. **Iniciar el servidor de desarrollo:**
```bash
bun dev
```

3. **Acceder:**
Abre `http://localhost:3000` en tu navegador.

## Reglas Generales

1. **El Jefe de Espías** conoce la identidad secreta de las 25 cartas.
2. Da una pista compuesta por **una sola palabra** y **un número** (la cantidad de cartas relacionadas).
3. Los compañeros de equipo intentan adivinar las cartas de su color.
4. Si tocan una carta de su color, siguen jugando. Si tocan una carta rival o neutral, el turno termina (o se penaliza tiempo en Modo Enlace Neural).
5. **¡Cuidado con el Asesino!** Si se revela, la partida termina al instante.

---
*Desarrollado por gek0v.*