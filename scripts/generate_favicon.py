from PIL import Image, ImageDraw
import os

# Create directories if not exist
os.makedirs('D:/test/pixpoints/public', exist_ok=True)

# Create 32x32 favicon
img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Background gradient simulation
def draw_gradient_rect(draw, xy, color1, color2):
    x1, y1, x2, y2 = xy
    for y in range(y1, y2):
        r = int(color1[0] + (color2[0] - color1[0]) * (y - y1) / (y2 - y1))
        g = int(color1[1] + (color2[1] - color1[1]) * (y - y1) / (y2 - y1))
        b = int(color1[2] + (color2[2] - color1[2]) * (y - y1) / (y2 - y1))
        draw.line([(x1, y), (x2, y)], fill=(r, g, b, 255))

# Draw rounded rectangle background
radius = 6
draw_gradient_rect(draw, (0, 0, 32, 32), (79, 70, 229), (124, 58, 237))

# Draw 4 white squares (PP pixel style)
square_size = 8
padding = 6
gap = 4

# Top-left
draw.rectangle([padding, padding, padding + square_size, padding + square_size], fill=(255, 255, 255, 230))
# Top-right
draw.rectangle([padding + square_size + gap, padding, padding + square_size * 2 + gap, padding + square_size], fill=(255, 255, 255, 230))
# Bottom-left
draw.rectangle([padding, padding + square_size + gap, padding + square_size, padding + square_size * 2 + gap], fill=(255, 255, 255, 230))
# Bottom-right
draw.rectangle([padding + square_size + gap, padding + square_size + gap, padding + square_size * 2 + gap, padding + square_size * 2 + gap], fill=(255, 255, 255, 230))

# Save favicon.ico
img.save('D:/test/pixpoints/public/favicon.ico', format='ICO', sizes=[(32, 32)])

# Create 180x180 apple touch icon
img_large = Image.new('RGBA', (180, 180), (0, 0, 0, 0))
draw_large = ImageDraw.Draw(img_large)

# Draw background
draw_gradient_rect(draw_large, (0, 0, 180, 180), (79, 70, 229), (124, 58, 237))

# Draw 4 white squares scaled up
square_size = 45
padding = 35
gap = 20

# Top-left
draw_large.rectangle([padding, padding, padding + square_size, padding + square_size], fill=(255, 255, 255, 230))
# Top-right
draw_large.rectangle([padding + square_size + gap, padding, padding + square_size * 2 + gap, padding + square_size], fill=(255, 255, 255, 230))
# Bottom-left
draw_large.rectangle([padding, padding + square_size + gap, padding + square_size, padding + square_size * 2 + gap], fill=(255, 255, 255, 230))
# Bottom-right
draw_large.rectangle([padding + square_size + gap, padding + square_size + gap, padding + square_size * 2 + gap, padding + square_size * 2 + gap], fill=(255, 255, 255, 230))

# Save apple touch icon
img_large.save('D:/test/pixpoints/public/apple-touch-icon.png', format='PNG')

# Create 192x192 icon for Android
img_192 = Image.new('RGBA', (192, 192), (0, 0, 0, 0))
draw_192 = ImageDraw.Draw(img_192)
draw_gradient_rect(draw_192, (0, 0, 192, 192), (79, 70, 229), (124, 58, 237))

square_size = 48
padding = 37
gap = 22

draw_192.rectangle([padding, padding, padding + square_size, padding + square_size], fill=(255, 255, 255, 230))
draw_192.rectangle([padding + square_size + gap, padding, padding + square_size * 2 + gap, padding + square_size], fill=(255, 255, 255, 230))
draw_192.rectangle([padding, padding + square_size + gap, padding + square_size, padding + square_size * 2 + gap], fill=(255, 255, 255, 230))
draw_192.rectangle([padding + square_size + gap, padding + square_size + gap, padding + square_size * 2 + gap, padding + square_size * 2 + gap], fill=(255, 255, 255, 230))

img_192.save('D:/test/pixpoints/public/icon-192x192.png', format='PNG')

print('Favicon files generated successfully!')
print('- favicon.ico (32x32)')
print('- apple-touch-icon.png (180x180)')
print('- icon-192x192.png (192x192)')