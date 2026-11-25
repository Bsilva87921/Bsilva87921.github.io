# 3D renders

One glossy 3D object per Probable Atlas module (economics, finance, commodities, weather, agriculture, hunger, wealth,
tech, conflict, politics, health and World Pulse), used on the Atlas home screen. They are rendered with three.js in a
soft studio light on a transparent background (`source/icons.js`, driven by `source/render.py` in headless Chromium)
and saved at 512 and 256 px as AVIF and WebP. The globe's continents come from the Atlas globe data (Natural Earth,
public domain). Original work for this portfolio.

## Project renders

`ai-lab`, `loan-lab`, `bank-complaints`, `fundraising`, `home-care` and `alteryx` (1200 and 600 px WebP) are stills of
the live 3D views on those project pages, captured from the pages themselves in headless Chromium with the labels
hidden. They are the project-card images on the home page and the still image a project page shows when the browser
cannot draw 3D.
