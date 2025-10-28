from io import BytesIO
from math import pi, log, tan, cos, sin, atan, sinh
from typing import Iterable, Tuple
from PIL import Image, ImageDraw

TILE_SIZE = 256
R_MAJOR = 6378137.0
ORIGIN_SHIFT = 2 * pi * R_MAJOR / 2.0

def meters_per_pixel(lat:float, z:int)->float:
    return (cos(lat*pi/180.0)*2*pi*R_MAJOR) / (TILE_SIZE * (2**z))

def lonlat_to_world_px(lon:float , lat:float, z:int)->Tuple[float,float]:
    #Web Mercator formula -> world pixels at zoom z
    x = (lon+180)/360.0
    s = sin(lat*pi/180)
    y = 0.5 - log((1+s)/(1-s))/(4*pi)
    scale = TILE_SIZE * (2**z)
    return (x*scale, y*scale)

def tile_bounds(z: int, x: int, y: int) -> Tuple[float, float, float, float]:
    # returns south, west, north, east in WGS84
    n = 2 ** z
    lon1 = x / n * 360.0 - 180.0
    lat1 = atan(sinh(pi * (1 - 2 * y / n))) * 180.0 / pi
    lon2 = (x + 1) / n * 360.0 - 180.0
    lat2 = atan(sinh(pi * (1 - 2 * (y + 1) / n))) * 180.0 / pi
    south, west = lat2, lon1
    north, east = lat1, lon2
    return south, west, north, east

def draw_points_tile(points: Iterable[Tuple[float, float]], z: int, x: int, y: int,
                     dot_radius: int = 2, fill=(0, 122, 255, 190)) -> bytes:
    img = Image.new("RGBA", (TILE_SIZE, TILE_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    x0 = x * TILE_SIZE
    y0 = y * TILE_SIZE

    for lat, lon in points:
        wx, wy = lonlat_to_world_px(lon, lat, z)
        px = int(round(wx - x0))
        py = int(round(wy - y0))
        if -4 <= px <= TILE_SIZE + 4 and -4 <= py <= TILE_SIZE + 4:
            draw.ellipse(
                (px - dot_radius, py - dot_radius, px + dot_radius, py + dot_radius),
                fill=fill
            )

    buf = BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()