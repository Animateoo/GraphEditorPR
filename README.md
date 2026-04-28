# 📉 GraphEditor PPro: Control Visual de Curvas en Premiere Pro

**GraphEditor PPro** es la versión adaptada para Adobe Premiere Pro de la popular herramienta de control de curvas. Permite manipular la velocidad e influencia de los keyframes mediante una interfaz visual intuitiva, superando las limitaciones del editor de gráficos nativo de Premiere.
<img width="927" height="542" alt="Curve 2" src="https://github.com/user-attachments/assets/9981a39e-9851-4499-969c-569c965b4d6d" />
---

## ✨ Características

*   🎮 **Editor Visual**: Ajusta curvas Bezier arrastrando manejadores.
*   🚀 **Velocidad e Influencia**: Control preciso de la aceleración y frenado (Ease In / Ease Out).
*   🎨 **Interfaz Moderna**: Diseñada para integrarse perfectamente en el espacio de trabajo de Premiere.
*   ⚡ **Aplicación Instantánea**: Los cambios se reflejan en tiempo real en tus clips.

---

## 🚀 Instalación (Paso a Paso)

1.  **Descarga**: Descarga o clona este repositorio.
2.  **Mover Carpeta**: Copia la carpeta de la extensión a la siguiente ruta:
    *   **Windows**: `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\`
    *   **macOS**: `/Library/Application Support/Adobe/CEP/extensions/`

---

## ⚠️ Configuración Crítica (Habilitar Extensiones)

Para que Premiere Pro reconozca la extensión (ya que es una herramienta de código abierto), debes habilitar el **PlayerDebugMode**.

### Para Windows:
1. Cierra Premiere Pro.
2. Abre el **Símbolo del sistema (CMD)** como administrador.
3. Copia y pega estos comandos uno por uno y pulsa Enter:

```cmd
reg add "HKCU\Software\Adobe\CSXS.10" /v PlayerDebugMode /t REG_SZ /d 1 /f
reg add "HKCU\Software\Adobe\CSXS.11" /v PlayerDebugMode /t REG_SZ /d 1 /f
reg add "HKCU\Software\Adobe\CSXS.12" /v PlayerDebugMode /t REG_SZ /d 1 /f
```

### Para macOS:
1. Abre la **Terminal**.
2. Ejecuta estos comandos:

```bash
defaults write com.adobe.CSXS.10 PlayerDebugMode 1
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
defaults write com.adobe.CSXS.12 PlayerDebugMode 1
```

---

## 📖 Cómo usar

1.  **Reinicia** Premiere Pro.
2.  Ve a **Ventana > Extensiones > GraphEditor PPro**.
3.  **Selecciona un clip** con keyframes en el panel de Control de Efectos.
4.  **Ajusta la curva** en el panel y observa cómo cambia el movimiento.

---

## 🤝 Contribuir y Mejorar

Este proyecto es una **Beta Abierta** y busco activamente colaboradores. Premiere tiene limitaciones técnicas complejas, así que si eres desarrollador y logras mejorar el código, optimizar las curvas o añadir funciones:

*   **¡Eres más que bienvenido!** Siéntete libre de hacer un **Fork** y subir tus mejoras mediante un **Pull Request**.
*   **Contáctame**: Si has logrado una mejora importante o quieres colaborar de forma más directa, no dudes en escribirme o contactarme a través de mis redes para que podamos actualizar la herramienta oficial para toda la comunidad.

Desarrollado con ❤️ por [Animateoo](https://github.com/Animateoo).

