# Anatomy models

Files in this folder (`*.glb`, `atlas.json`) come from Shandon's Body Atlas
(https://github.com/ryanjardine95/shandons-body-atlas), built from Z-Anatomy.

Model data: Z-Anatomy - the libre 3D atlas of anatomy (CC-BY-SA 4.0), derived from
BodyParts3D (c) The Database Center for Life Science. The GLB files remain under CC-BY-SA 4.0.

# Spacesuit model

`suit.glb` is the Z-2 prototype planetary suit from NASA 3D Resources (Advanced Concepts Lab), free to use under the
NASA media usage guidelines: https://github.com/nasa/NASA-3D-Resources

Changes made for Orbitalis: the textures were reduced to 2048 px (WebP), and the flag and NASA insignia patches were
painted out of the color map, because the crew is fictional. The baked dirt on the fabric panels was also removed from the
color map (panel by panel, keeping seams, stripes, the patch and the gloves). The geometry (Draco) is unchanged on disk; at load
time Orbitalis re-poses the arms to hang at the sides and fits the torso, helmet and legs to each crew member's body.
`public/draco` holds the Draco decoder that ships with three.js (Apache-2.0).

# Crew heads

`heads/*.glb` are derived from avatars of the Microsoft Rocketbox library (https://github.com/microsoft/Microsoft-Rocketbox), used under
the MIT License. The avatars are generic characters that do not depict real people (see Gonzalez-Franco et al., 2020, "The Rocketbox
library and the utility of freely available rigged avatars", Frontiers in Virtual Reality, doi:10.3389/frvir.2020.561558). Changes made
for Orbitalis: only the head, neck and hair were kept; they were scaled and moved onto the anatomical body, the textures were reduced and
converted to WebP, and the iris color of two of them was repainted. See `tools/heads/README.md`.

    MIT License

    Copyright (c) 2020 Microsoft

    Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files
    (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge,
    publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do
    so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
    FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
    WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
