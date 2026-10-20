"""The record store's furniture, modelled in Blender and exported as glTF.

    blender -b -P scripts/store-models.py

Writes public/store/models/store.glb and room.glb. Run it again after
changing anything here, or after scripts/store-textures.py.

Every piece is built to the same measurements as the shelves the engine
lays items onto (SectionLayout in src/components/store/engine/worlds.ts),
in the same world coordinates, so the models drop in over the plain
geometry and every CD still lands in its slot. If a layout number changes
there, change it here.

The PS2 look is in two things: textures that read as photographs at low
resolution (scripts/store-textures.py), and lighting baked into the
vertex colours. Each piece is subdivided enough to carry the bake, then
Cycles bakes ambient occlusion - with a temporary floor and back wall, so
undersides and corners darken where they meet them - into a colour
attribute that the glTF carries as COLOR_0 and three.js multiplies in.
"""
import math
import os

import bmesh
import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TEX = os.path.join(ROOT, "public/store/tex")
OUT = os.path.join(ROOT, "public/store/models")

# ---------------------------------------------------------------- setup


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    scene.render.bake.margin = 2


MATS = {}


def material(name, tex=None, color=(1, 1, 1), rough=0.7, metal=0.0):
    key = (name, tex)
    if key in MATS:
        return MATS[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if tex:
        img = bpy.data.images.load(os.path.join(TEX, f"{tex}.png"), check_existing=True)
        node = nt.nodes.new("ShaderNodeTexImage")
        node.image = img
        node.interpolation = "Closest"
        nt.links.new(node.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = (*color, 1)
    MATS[key] = m
    return m


# ------------------------------------------------------------- building

PIECES = []  # everything that is exported
OCCLUDERS = []  # bake-only: floor, walls


def block(name, size, at, mat, bevel=0.025, uv=2.0, collection=PIECES):
    """A box, bevelled, subdivided for the bake, cube-projected UVs."""
    sx, sy, sz = size  # x, height, depth in the engine's terms (y up)
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    # Engine axes are y-up; Blender is z-up. Build in Blender axes:
    # engine (x, y, z) -> blender (x, -z, y).
    bmesh.ops.scale(bm, vec=(sx, sz, sy), verts=bm.verts)
    if bevel > 0 and min(size) > bevel * 3:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=1, affect="EDGES", profile=0.5)
    # Enough vertices for the baked light to have somewhere to live.
    longest = max(size)
    cuts = max(0, min(10, int(longest / 0.45)))
    if cuts:
        bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if e.calc_length() > 0.5], cuts=1, use_grid_fill=True)
    bm.to_mesh(me)
    bm.free()
    x, y, z = at
    ob.location = (x, -z, y)
    ob.data.materials.append(mat)
    # UVs: a cube projection at a fixed texel density, so wood grain is
    # the same size on every piece.
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.cube_project(cube_size=uv, correct_aspect=True)
    bpy.ops.object.mode_set(mode="OBJECT")
    collection.append(ob)
    return ob


# Materials.
OAK = lambda: material("oak", "oak")  # noqa: E731
WALNUT = lambda: material("walnut", "walnut")  # noqa: E731
PINE = lambda: material("pine", "pine")  # noqa: E731
MDF = lambda: material("mdf", "mdf_black")  # noqa: E731
METAL = lambda: material("metal", "metal", rough=0.35, metal=0.6)  # noqa: E731
BRASS = lambda: material("brass", color=(0.86, 0.66, 0.26), rough=0.3, metal=0.8)  # noqa: E731
CREAM = lambda: material("cream", color=(0.9, 0.86, 0.76), rough=0.9)  # noqa: E731
BEDSPREAD = lambda: material("bedspread", "bedspread", rough=0.95)  # noqa: E731
GLASS = lambda: material("glass", color=(0.55, 0.78, 0.9), rough=0.1)  # noqa: E731


def shelf_unit(name, cx, y0, cols, rows, cw, ch, dep, lip=False, wood=OAK, back=WALNUT, base_cabinet=False):
    """Same frame as shelfUnit() in gfx.ts, with the joinery a real one has."""
    W = cols * cw + 0.5
    H = rows * ch + 0.45
    # Back panel and sides.
    block(f"{name}_back", (W, H, 0.12), (cx, y0 + H / 2, -dep / 2), back(), bevel=0)
    for sx in (-1, 1):
        block(f"{name}_side{sx}", (0.26, H + 0.1, dep), (cx + sx * (W / 2 - 0.13), y0 + H / 2, 0), wood())
        # The routed inset on the side panel's face.
        block(f"{name}_sideinset{sx}", (0.04, H - 0.5, dep - 0.4), (cx + sx * (W / 2 + 0.005), y0 + H / 2, 0), back(), bevel=0)
    # Top, and a crown moulding over it.
    block(f"{name}_top", (W, 0.3, dep), (cx, y0 + H - 0.15, 0), wood())
    block(f"{name}_crown", (W + 0.3, 0.16, dep + 0.22), (cx, y0 + H + 0.08, 0.06), wood())
    block(f"{name}_crown2", (W + 0.14, 0.1, dep + 0.12), (cx, y0 + H - 0.02, 0.04), back())
    # Shelves, each with a darker front edge strip and, on the LP wall, a lip.
    for r in range(rows + 1):
        y = y0 + 0.07 + r * ch
        block(f"{name}_shelf{r}", (W - 0.5, 0.14, dep), (cx, y, 0), wood())
        block(f"{name}_edge{r}", (W - 0.5, 0.16, 0.05), (cx, y, dep / 2 + 0.02), back(), bevel=0.01)
        if lip and r < rows:
            block(f"{name}_lip{r}", (W - 0.5, 0.3, 0.1), (cx, y + 0.23, dep / 2 - 0.05), wood())
    # Plinth with a recessed toe kick.
    block(f"{name}_plinth", (W, 0.4, dep + 0.15), (cx, y0 - 0.1, 0.05), back())
    if base_cabinet and y0 > 1.2:
        # A cupboard under the wall-hung units, so nothing floats.
        hb = y0 - 0.3
        block(f"{name}_cab", (W, hb, dep + 0.1), (cx, hb / 2 + 0.06, 0.02), wood())
        block(f"{name}_kick", (W - 0.3, 0.14, 0.06), (cx, 0.07, dep / 2 - 0.02), MDF(), bevel=0)
        doors = max(2, cols // 2)
        dw = (W - 0.3) / doors
        for d in range(doors):
            dx = cx - (W - 0.3) / 2 + dw * (d + 0.5)
            block(f"{name}_door{d}", (dw - 0.08, hb - 0.42, 0.06), (dx, hb / 2 + 0.16, dep / 2 + 0.08), back())
            block(f"{name}_knob{d}", (0.12, 0.12, 0.1), (dx + dw * 0.32, hb / 2 + 0.16, dep / 2 + 0.15), BRASS(), bevel=0.02)


def store():
    reset()
    # Mirrors LAYOUT in worlds.ts.
    shelf_unit("cd", 0, 1.0, 4, 3, 1.85, 2.05, 1.5)
    shelf_unit("vinyl", 15, 1.0, 4, 2, 3.6, 3.9, 1.4, lip=True, wood=PINE)
    shelf_unit("tape", 47.5, 3.0, 5, 2, 1.25, 1.75, 1.1, base_cabinet=True)
    shelf_unit("dvd", 62, 1.8, 5, 2, 1.8, 2.55, 1.3, base_cabinet=True, wood=WALNUT, back=MDF)

    # The listening post: a long bench with an upper shelf on two uprights.
    bx = 31
    block("listen_body", (12.4, 2.9, 3.6), (bx, 1.5, 0.9), WALNUT())
    block("listen_top", (12.8, 0.22, 4.0), (bx, 3.1, 0.9), OAK())
    block("listen_kick", (12.0, 0.2, 0.08), (bx, 0.1, 2.72), MDF(), bevel=0)
    for i in range(4):
        block(f"listen_panel{i}", (2.7, 2.0, 0.06), (bx - 4.6 + i * 3.07, 1.55, 2.74), OAK())
    block("listen_upper", (13.0, 0.22, 3.0), (bx + 0.6, 5.8, 0.35), OAK())
    block("listen_post_l", (0.3, 2.6, 2.6), (bx - 5.4, 4.5, 0.35), WALNUT())
    block("listen_post_r", (0.3, 2.6, 2.6), (bx + 6.7, 4.5, 0.35), WALNUT())

    # The till.
    cx = 77
    block("counter_body", (9.0, 3.2, 2.4), (cx, 1.65, 2.7), WALNUT())
    block("counter_top", (9.4, 0.28, 2.9), (cx, 3.4, 2.7), OAK())
    block("counter_trim", (9.0, 0.18, 0.12), (cx, 3.0, 3.95), BRASS(), bevel=0.02)
    block("counter_kick", (8.6, 0.24, 0.08), (cx, 0.12, 3.92), MDF(), bevel=0)
    for i in range(3):
        block(f"counter_panel{i}", (2.6, 2.0, 0.06), (cx - 2.9 + i * 2.9, 1.7, 3.93), OAK())

    bake_and_export("store", floor_y=0.0, wall_z=-1.0, span=(-12, 92))


def room():
    reset()
    # Dresser with drawers.
    block("dresser", (8.0, 2.9, 2.6), (-8, 1.5, -7.5), WALNUT())
    block("dresser_top", (8.4, 0.22, 3.0), (-8, 3.1, -7.5), OAK())
    for x in (-9.8, -6.2):
        for r in range(2):
            block(f"drawer{x}{r}", (3.2, 1.1, 0.1), (x, 0.85 + r * 1.2, -6.15), OAK())
            block(f"handle{x}{r}", (0.9, 0.1, 0.12), (x, 0.85 + r * 1.2, -6.05), BRASS(), bevel=0.02)
    # TV stand.
    block("tvstand", (7.6, 2.1, 2.6), (0, 1.1, -7.5), WALNUT())
    block("tvstand_top", (8.0, 0.2, 3.0), (0, 2.3, -7.5), OAK())
    block("tvstand_shelf", (7.0, 0.1, 2.2), (0, 1.1, -7.2), OAK())
    # Desk on legs, with a modesty panel.
    block("desk_top", (8.0, 0.3, 3.2), (8.4, 3.3, -7.4), PINE())
    for x in (-3.7, 3.7):
        block(f"desk_leg{x}", (0.4, 3.15, 3.0), (8.4 + x, 1.6, -7.4), WALNUT())
    block("desk_back", (7.4, 2.2, 0.3), (8.4, 2.2, -8.6), WALNUT())
    # Bed.
    block("bed_frame", (9.0, 0.7, 9.0), (0, 0.9, 8.2), WALNUT())
    block("mattress", (8.6, 1.2, 8.6), (0, 1.6, 8.2), BEDSPREAD(), bevel=0.12)
    block("pillow", (3.0, 0.5, 1.6), (-2.4, 2.45, 5.2), CREAM(), bevel=0.18)
    block("headboard", (9.0, 3.4, 0.5), (0, 2.5, 12.4), WALNUT())
    block("headboard_rail", (9.2, 0.25, 0.6), (0, 4.3, 12.4), OAK())
    for x in (-4.4, 4.4):
        block(f"bed_leg{x}", (0.4, 0.6, 0.4), (x, 0.3, 4.0), WALNUT())
    # The collection shelf is a shelf unit like the shop's, built in its
    # own local frame (the engine rotates it onto the left wall).
    shelf_unit("collection", 0, 1.0, 6, 3, 2.05, 2.6, 1.4, lip=True, wood=PINE)
    bake_and_export("room", floor_y=0.0, wall_z=-9.0, span=(-12, 12), split={"collection_": "collection"})


# ---------------------------------------------------------- bake + export


def bake_and_export(name, floor_y, wall_z, span, split=None):
    # Bake-only occluders: the floor and the wall behind, so contact
    # shadows land where furniture meets them.
    x0, x1 = span
    floor = block("_floor", (x1 - x0, 0.1, 40), ((x0 + x1) / 2, floor_y - 0.05, 0), CREAM(), bevel=0, collection=OCCLUDERS)
    wall = block("_wall", (x1 - x0, 14, 0.1), ((x0 + x1) / 2, 7, wall_z - 0.05), CREAM(), bevel=0, collection=OCCLUDERS)
    del floor, wall

    for ob in PIECES:
        ob.data.color_attributes.new("AO", "BYTE_COLOR", "CORNER")
    bpy.ops.object.select_all(action="DESELECT")
    for ob in PIECES:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = PIECES[0]
    scene = bpy.context.scene
    scene.render.bake.target = "VERTEX_COLORS"
    bpy.ops.object.bake(type="AO")

    # Brighten the bake into a range that multiplies nicely: the PS2 never
    # went fully black in a corner.
    for ob in PIECES:
        attr = ob.data.color_attributes["AO"]
        for d in attr.data:
            v = d.color[0]
            v = 0.42 + 0.58 * v
            d.color = (v, v * 0.97, v * 0.93, 1.0)

    for ob in OCCLUDERS:
        bpy.data.objects.remove(ob, do_unlink=True)

    groups = {name: [o for o in PIECES]}
    if split:
        for prefix, out_name in split.items():
            groups[out_name] = [o for o in PIECES if o.name.startswith(prefix)]
            groups[name] = [o for o in groups[name] if not o.name.startswith(prefix)]
    os.makedirs(OUT, exist_ok=True)
    for out_name, obs in groups.items():
        bpy.ops.object.select_all(action="DESELECT")
        for ob in obs:
            ob.select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=os.path.join(OUT, f"{out_name}.glb"),
            export_format="GLB",
            use_selection=True,
            export_colors=True,
            export_yup=True,
            export_apply=True,
            export_image_format="AUTO",
        )
        print("wrote", out_name, len(obs), "pieces")
    PIECES.clear()
    OCCLUDERS.clear()
    MATS.clear()


store()
room()
