# Experience photo journal

33 original photographs are grouped into 13 albums here. The JPEG files retain the exact uploaded bytes. Redundant copies in the repository root have been removed; original names and checksums from the initial import are recorded in `archive/photo-sources.json`. Medical Developer photo 02 was subsequently removed by the owner and is no longer included in the website.

Edit album labels, categories, image descriptions, and ordering in `src/data/experiencePhotos.ts`. Each image has a unique ID and a path such as `/images/experience/duta-anti-narkoba/01.jpg`.

Section 02 at `/#experience` shows six selected experiences in an automatically drifting horizontal row. Each album has its own looping slideshow: photographs advance every 1.8 seconds with a visible 300 ms horizontal slide. Hovering and pausing the outer row do not stop the photo slideshow. Manual scrolling, photo dots, and an individual pause button are available. Dragging, keyboard focus, or the photo pause button stops autoplay; manual controls remain available. More experiences opens all 13 roles. Each experience opens its own details and photo viewer with keyboard arrows, touch swipes, thumbnails, and the original file link. The optional `href` on a photo links to its Instagram source instead. Next.js serves responsive, lazy-loaded images. System reduced motion disables autoplay.

To add a photo, place the JPEG in its album folder with the next two-digit number and add a description to that album's list. Rebuild the production website after changing assets or data.
