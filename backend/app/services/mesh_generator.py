import struct
import json
import math
import hashlib
from typing import List, Tuple, Dict, Any

class MeshData:
    def __init__(self, vertices: List[Tuple[float, float, float]], 
                 faces: List[Tuple[int, int, int]], 
                 normals: List[Tuple[float, float, float]] = None,
                 colors: List[Tuple[float, float, float]] = None,
                 name: str = "Mesh"):
        self.name = name
        self.vertices = vertices
        self.faces = faces
        self.colors = colors or [(0.3, 0.7, 0.9)] * len(vertices)
        if normals and len(normals) == len(vertices):
            self.normals = normals
        else:
            self.normals = self._compute_vertex_normals()

    def _compute_vertex_normals(self) -> List[Tuple[float, float, float]]:
        normals = [[0.0, 0.0, 0.0] for _ in range(len(self.vertices))]
        for i1, i2, i3 in self.faces:
            v1 = self.vertices[i1]
            v2 = self.vertices[i2]
            v3 = self.vertices[i3]
            # Cross product (v2 - v1) x (v3 - v1)
            ax, ay, az = v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]
            bx, by, bz = v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]
            nx = ay * bz - az * by
            ny = az * bx - ax * bz
            nz = ax * by - ay * bx
            length = math.sqrt(nx * nx + ny * ny + nz * nz)
            if length > 1e-6:
                nx, ny, nz = nx / length, ny / length, nz / length
            for idx in (i1, i2, i3):
                normals[idx][0] += nx
                normals[idx][1] += ny
                normals[idx][2] += nz
        
        result = []
        for n in normals:
            l = math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2])
            if l > 1e-6:
                result.append((n[0] / l, n[1] / l, n[2] / l))
            else:
                result.append((0.0, 1.0, 0.0))
        return result

    @property
    def vertex_count(self) -> int:
        return len(self.vertices)

    @property
    def poly_count(self) -> int:
        return len(self.faces)

    def get_bounds(self) -> Tuple[Tuple[float, float, float], Tuple[float, float, float]]:
        if not self.vertices:
            return ((0,0,0), (0,0,0))
        min_x = min(v[0] for v in self.vertices)
        min_y = min(v[1] for v in self.vertices)
        min_z = min(v[2] for v in self.vertices)
        max_x = max(v[0] for v in self.vertices)
        max_y = max(v[1] for v in self.vertices)
        max_z = max(v[2] for v in self.vertices)
        return ((min_x, min_y, min_z), (max_x, max_y, max_z))

    def export_obj(self) -> str:
        lines = [f"# PolyGen Generated Asset: {self.name}", f"o {self.name}"]
        for v in self.vertices:
            lines.append(f"v {v[0]:.5f} {v[1]:.5f} {v[2]:.5f}")
        for n in self.normals:
            lines.append(f"vn {n[0]:.5f} {n[1]:.5f} {n[2]:.5f}")
        for f in self.faces:
            # 1-based indexing for OBJ
            lines.append(f"f {f[0]+1}//{f[0]+1} {f[1]+1}//{f[1]+1} {f[2]+1}//{f[2]+1}")
        return "\n".join(lines)

    def export_stl(self) -> bytes:
        header = f"PolyGen Binary STL: {self.name}".encode("ascii")[:80].ljust(80, b"\0")
        tri_count = len(self.faces)
        buffer = bytearray(header)
        buffer.extend(struct.pack("<I", tri_count))
        for f in self.faces:
            v1, v2, v3 = self.vertices[f[0]], self.vertices[f[1]], self.vertices[f[2]]
            # face normal
            ax, ay, az = v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]
            bx, by, bz = v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]
            nx, ny, nz = ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx
            l = math.sqrt(nx*nx + ny*ny + nz*nz)
            if l > 1e-6:
                nx, ny, nz = nx/l, ny/l, nz/l
            else:
                nx, ny, nz = 0.0, 1.0, 0.0
            
            buffer.extend(struct.pack("<3f", nx, ny, nz))
            buffer.extend(struct.pack("<3f", v1[0], v1[1], v1[2]))
            buffer.extend(struct.pack("<3f", v2[0], v2[1], v2[2]))
            buffer.extend(struct.pack("<3f", v3[0], v3[1], v3[2]))
            buffer.extend(struct.pack("<H", 0))  # attribute byte count
        return bytes(buffer)

    def export_glb(self) -> bytes:
        """
        Creates a compliant, self-contained binary glTF 2.0 (.glb) container
        with standard PBR metallic-roughness material, vertex positions, normals, and indices.
        """
        bin_data = bytearray()
        
        # 1. Position buffer (float32 x 3)
        pos_offset = len(bin_data)
        min_v = [float("inf")] * 3
        max_v = [float("-inf")] * 3
        for v in self.vertices:
            bin_data.extend(struct.pack("<3f", v[0], v[1], v[2]))
            for i in range(3):
                if v[i] < min_v[i]: min_v[i] = v[i]
                if v[i] > max_v[i]: max_v[i] = v[i]
        pos_length = len(bin_data) - pos_offset

        # 2. Normal buffer (float32 x 3)
        normal_offset = len(bin_data)
        for n in self.normals:
            bin_data.extend(struct.pack("<3f", n[0], n[1], n[2]))
        normal_length = len(bin_data) - normal_offset

        # 3. Index buffer (uint32)
        idx_offset = len(bin_data)
        for f in self.faces:
            bin_data.extend(struct.pack("<3I", f[0], f[1], f[2]))
        idx_length = len(bin_data) - idx_offset

        # Align bin_data to 4 bytes
        while len(bin_data) % 4 != 0:
            bin_data.append(0)

        total_bin_len = len(bin_data)

        # Build glTF structure
        gltf = {
            "asset": {"version": "2.0", "generator": "PolyGen 3D Engine v1.0"},
            "scene": 0,
            "scenes": [{"nodes": [0]}],
            "nodes": [{"mesh": 0, "name": self.name}],
            "materials": [{
                "name": "PolyGen_Material",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.22, 0.65, 0.95, 1.0],
                    "metallicFactor": 0.6,
                    "roughnessFactor": 0.35
                },
                "doubleSided": True
            }],
            "meshes": [{
                "name": self.name,
                "primitives": [{
                    "attributes": {
                        "POSITION": 0,
                        "NORMAL": 1
                    },
                    "indices": 2,
                    "material": 0,
                    "mode": 4  # TRIANGLES
                }]
            }],
            "buffers": [{"byteLength": total_bin_len}],
            "bufferViews": [
                {
                    "buffer": 0,
                    "byteOffset": pos_offset,
                    "byteLength": pos_length,
                    "target": 34962  # ARRAY_BUFFER
                },
                {
                    "buffer": 0,
                    "byteOffset": normal_offset,
                    "byteLength": normal_length,
                    "target": 34962  # ARRAY_BUFFER
                },
                {
                    "buffer": 0,
                    "byteOffset": idx_offset,
                    "byteLength": idx_length,
                    "target": 34963  # ELEMENT_ARRAY_BUFFER
                }
            ],
            "accessors": [
                {
                    "bufferView": 0,
                    "byteOffset": 0,
                    "componentType": 5126,  # FLOAT
                    "count": len(self.vertices),
                    "type": "VEC3",
                    "min": min_v,
                    "max": max_v
                },
                {
                    "bufferView": 1,
                    "byteOffset": 0,
                    "componentType": 5126,  # FLOAT
                    "count": len(self.normals),
                    "type": "VEC3"
                },
                {
                    "bufferView": 2,
                    "byteOffset": 0,
                    "componentType": 5125,  # UNSIGNED_INT
                    "count": len(self.faces) * 3,
                    "type": "SCALAR",
                    "min": [0],
                    "max": [len(self.vertices) - 1]
                }
            ]
        }

        json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
        # Pad JSON to 4-byte boundary with spaces (0x20)
        while len(json_bytes) % 4 != 0:
            json_bytes += b" "

        json_len = len(json_bytes)
        total_len = 12 + 8 + json_len + 8 + total_bin_len

        # Header: magic (glTF), version (2), length
        header = struct.pack("<4sII", b"glTF", 2, total_len)
        # JSON chunk header: length, type (JSON = 0x4E4F534A)
        json_chunk_hdr = struct.pack("<II", json_len, 0x4E4F534A)
        # BIN chunk header: length, type (BIN = 0x004E4942)
        bin_chunk_hdr = struct.pack("<II", total_bin_len, 0x004E4942)

        return header + json_chunk_hdr + json_bytes + bin_chunk_hdr + bytes(bin_data)


class ProceduralMeshFactory:
    """
    Constructs rich, aesthetically pleasing 3D geometries for the demo provider:
    - Cyber Mech Recon Drone
    - Sci-Fi Plasma Blaster
    - Obsidian Monolith Crystal
    - Gyroscope Quantum Core
    - Tactical Exo Helmet
    - Parametric Generative Shape based on arbitrary prompt seeds
    """

    @staticmethod
    def create_crystal(detail: int = 2, scale: float = 1.0, seed: int = 42) -> MeshData:
        vertices = []
        faces = []
        
        # Central spire
        apex_top = (0.0, 2.5 * scale, 0.0)
        apex_bot = (0.0, -1.8 * scale, 0.0)
        vertices.append(apex_top)  # 0
        vertices.append(apex_bot)  # 1

        ring_pts = 7
        for i in range(ring_pts):
            angle = i * 2 * math.pi / ring_pts
            jitter = 0.8 + 0.3 * math.sin(angle * 3 + seed)
            r = 0.9 * scale * jitter
            y = 0.3 * scale * math.cos(angle * 2 + seed)
            vertices.append((r * math.cos(angle), y, r * math.sin(angle)))

        # Sub ring
        for i in range(ring_pts):
            angle = (i + 0.5) * 2 * math.pi / ring_pts
            r = 0.55 * scale
            y = -0.6 * scale
            vertices.append((r * math.cos(angle), y, r * math.sin(angle)))

        # Faces connecting apex_top to upper ring (indices 2 to 2+ring_pts-1)
        for i in range(ring_pts):
            curr_i = 2 + i
            next_i = 2 + (i + 1) % ring_pts
            faces.append((0, curr_i, next_i))

        # Mid faces between upper and lower ring
        for i in range(ring_pts):
            u1 = 2 + i
            u2 = 2 + (i + 1) % ring_pts
            l1 = 2 + ring_pts + i
            l2 = 2 + ring_pts + (i + 1) % ring_pts
            faces.append((u1, l1, u2))
            faces.append((u2, l1, l2))

        # Bottom apex to lower ring
        for i in range(ring_pts):
            l1 = 2 + ring_pts + i
            l2 = 2 + ring_pts + (i + 1) % ring_pts
            faces.append((1, l2, l1))

        # Add decorative cluster crystals around base
        base_offset = len(vertices)
        for cluster in range(4):
            c_angle = cluster * math.pi / 2 + 0.3
            cx, cz = 0.8 * math.cos(c_angle), 0.8 * math.sin(c_angle)
            c_apex = (cx * 1.5, 0.9 * scale, cz * 1.5)
            c_idx = len(vertices)
            vertices.append(c_apex)
            
            c_ring_start = len(vertices)
            for j in range(4):
                a = j * math.pi / 2
                vx = cx + 0.3 * math.cos(a)
                vy = -0.5 * scale
                vz = cz + 0.3 * math.sin(a)
                vertices.append((vx, vy, vz))
            
            for j in range(4):
                p1 = c_ring_start + j
                p2 = c_ring_start + (j + 1) % 4
                faces.append((c_idx, p1, p2))

        return MeshData(vertices, faces, name="Obsidian_Crystal_Cluster")

    @staticmethod
    def create_drone(scale: float = 1.0) -> MeshData:
        vertices = []
        faces = []

        def add_box(cx, cy, cz, sx, sy, sz):
            start = len(vertices)
            hx, hy, hz = sx / 2, sy / 2, sz / 2
            corners = [
                (-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz),
                (-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)
            ]
            for dx, dy, dz in corners:
                vertices.append((cx + dx, cy + dy, cz + dz))
            
            # 6 faces * 2 triangles
            quads = [
                (0, 1, 2, 3), (5, 4, 7, 6), # front, back
                (4, 0, 3, 7), (1, 5, 6, 2), # left, right
                (3, 2, 6, 7), (4, 5, 1, 0)  # top, bottom
            ]
            for q in quads:
                faces.append((start + q[0], start + q[1], start + q[2]))
                faces.append((start + q[0], start + q[2], start + q[3]))

        # Central Cockpit / Core
        add_box(0, 0, 0, 1.4 * scale, 0.6 * scale, 1.8 * scale)
        # Upper canopy
        add_box(0, 0.4 * scale, 0.2 * scale, 0.9 * scale, 0.4 * scale, 1.2 * scale)
        # Left Wing Thruster Arm
        add_box(-1.4 * scale, 0.1 * scale, -0.2 * scale, 1.5 * scale, 0.2 * scale, 0.5 * scale)
        add_box(-2.1 * scale, 0.1 * scale, -0.2 * scale, 0.6 * scale, 0.6 * scale, 1.0 * scale)
        # Right Wing Thruster Arm
        add_box(1.4 * scale, 0.1 * scale, -0.2 * scale, 1.5 * scale, 0.2 * scale, 0.5 * scale)
        add_box(2.1 * scale, 0.1 * scale, -0.2 * scale, 0.6 * scale, 0.6 * scale, 1.0 * scale)
        # Forward Sensor Array / Optics
        add_box(0, -0.15 * scale, 1.0 * scale, 0.7 * scale, 0.3 * scale, 0.4 * scale)
        # Rear Fin Stabs
        add_box(-0.6 * scale, 0.5 * scale, -0.9 * scale, 0.15 * scale, 0.6 * scale, 0.5 * scale)
        add_box(0.6 * scale, 0.5 * scale, -0.9 * scale, 0.15 * scale, 0.6 * scale, 0.5 * scale)

        return MeshData(vertices, faces, name="Cyber_Recon_Drone")

    @staticmethod
    def create_helmet(scale: float = 1.0) -> MeshData:
        vertices = []
        faces = []

        # Dome sphere segments
        lat_bands = 14
        long_bands = 20
        radius = 1.0 * scale

        for lat in range(lat_bands + 1):
            theta = lat * math.pi / lat_bands
            sin_t = math.sin(theta)
            cos_t = math.cos(theta)
            for lon in range(long_bands + 1):
                phi = lon * 2 * math.pi / long_bands
                sin_p = math.sin(phi)
                cos_p = math.cos(phi)
                
                # Deform sphere into helmet shape
                x = radius * sin_t * cos_p
                y = radius * cos_t * 1.2
                z = radius * sin_t * sin_p * 1.15
                
                # Chin / jaw contour
                if y < 0 and z > 0:
                    z *= 1.3
                    y *= 0.8
                
                vertices.append((x, y, z))

        for lat in range(lat_bands):
            for lon in range(long_bands):
                first = (lat * (long_bands + 1)) + lon
                second = first + long_bands + 1
                faces.append((first, second, first + 1))
                faces.append((second, second + 1, first + 1))

        # Add futuristic visor bar
        visor_start = len(vertices)
        v_width = 1.05 * scale
        v_height = 0.35 * scale
        v_depth = 0.2 * scale
        vz = 1.15 * scale
        corners = [
            (-v_width/2, -v_height/2, vz), (v_width/2, -v_height/2, vz),
            (v_width/2, v_height/2, vz), (-v_width/2, v_height/2, vz),
            (-v_width/2, -v_height/2, vz + v_depth), (v_width/2, -v_height/2, vz + v_depth),
            (v_width/2, v_height/2, vz + v_depth), (-v_width/2, v_height/2, vz + v_depth)
        ]
        for c in corners:
            vertices.append(c)
        quads = [
            (0, 1, 2, 3), (5, 4, 7, 6), (4, 0, 3, 7), (1, 5, 6, 2), (3, 2, 6, 7), (4, 5, 1, 0)
        ]
        for q in quads:
            faces.append((visor_start + q[0], visor_start + q[1], visor_start + q[2]))
            faces.append((visor_start + q[0], visor_start + q[2], visor_start + q[3]))

        return MeshData(vertices, faces, name="Tactical_Exo_Helmet")

    @staticmethod
    def create_gyro_artifact(scale: float = 1.0) -> MeshData:
        vertices = []
        faces = []

        def add_torus(r_maj, r_min, seg_u, seg_v, tilt_axis="x", tilt_angle=0.0):
            base_idx = len(vertices)
            cos_a = math.cos(tilt_angle)
            sin_a = math.sin(tilt_angle)
            for u in range(seg_u):
                phi = u * 2 * math.pi / seg_u
                for v in range(seg_v):
                    theta = v * 2 * math.pi / seg_v
                    px = (r_maj + r_min * math.cos(theta)) * math.cos(phi)
                    py = (r_maj + r_min * math.cos(theta)) * math.sin(phi)
                    pz = r_min * math.sin(theta)
                    
                    if tilt_axis == "x":
                        rx = px
                        ry = py * cos_a - pz * sin_a
                        rz = py * sin_a + pz * cos_a
                    elif tilt_axis == "y":
                        rx = px * cos_a + pz * sin_a
                        ry = py
                        rz = -px * sin_a + pz * cos_a
                    else:
                        rx, ry, rz = px, py, pz
                    vertices.append((rx, ry, rz))

            for u in range(seg_u):
                next_u = (u + 1) % seg_u
                for v in range(seg_v):
                    next_v = (v + 1) % seg_v
                    i1 = base_idx + u * seg_v + v
                    i2 = base_idx + next_u * seg_v + v
                    i3 = base_idx + next_u * seg_v + next_v
                    i4 = base_idx + u * seg_v + next_v
                    faces.append((i1, i2, i3))
                    faces.append((i1, i3, i4))

        # Ring 1 (outer)
        add_torus(1.6 * scale, 0.08 * scale, 24, 10, "x", 0.4)
        # Ring 2 (mid)
        add_torus(1.2 * scale, 0.07 * scale, 24, 10, "y", 0.8)
        # Ring 3 (inner)
        add_torus(0.8 * scale, 0.06 * scale, 20, 8, "x", -0.5)

        # Central floating polyhedral energy core (Icosahedron)
        core_start = len(vertices)
        t = (1.0 + math.sqrt(5.0)) / 2.0 * 0.4 * scale
        s = 0.4 * scale
        ico_verts = [
            (-s, t, 0), (s, t, 0), (-s, -t, 0), (s, -t, 0),
            (0, -s, t), (0, s, t), (0, -s, -t), (0, s, -t),
            (t, 0, -s), (t, 0, s), (-t, 0, -s), (-t, 0, s)
        ]
        for iv in ico_verts:
            vertices.append(iv)
        ico_faces = [
            (0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11),
            (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8),
            (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9),
            (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)
        ]
        for iface in ico_faces:
            faces.append((core_start + iface[0], core_start + iface[1], core_start + iface[2]))

        return MeshData(vertices, faces, name="Quantum_Gyro_Artifact")

    @classmethod
    def generate_by_prompt(cls, prompt: str, style: str = "scifi", seed: int = None) -> MeshData:
        lower = prompt.lower()
        if any(w in lower for w in ["drone", "ship", "aircraft", "robot", "mech", "cyber", "vehicle", "plane"]):
            return cls.create_drone()
        elif any(w in lower for w in ["helmet", "head", "mask", "face", "suit", "armor", "visor"]):
            return cls.create_helmet()
        elif any(w in lower for w in ["crystal", "gem", "monolith", "mineral", "rock", "stone", "shard"]):
            return cls.create_crystal(seed=seed or 42)
        elif any(w in lower for w in ["core", "orb", "gyro", "portal", "quantum", "relic", "artifact"]):
            return cls.create_gyro_artifact()
        else:
            # Hash prompt to pick or generate variant
            h = int(hashlib.md5(prompt.encode()).hexdigest(), 16)
            choice = h % 4
            if choice == 0:
                return cls.create_drone()
            elif choice == 1:
                return cls.create_crystal(seed=h % 1000)
            elif choice == 2:
                return cls.create_helmet()
            else:
                return cls.create_gyro_artifact()
