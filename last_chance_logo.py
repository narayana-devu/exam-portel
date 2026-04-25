import base64
import re
import sys
from PIL import Image, ImageChops
import io

html_path = r"c:\Users\DELL\Downloads\portel-master (2)\portel-master\client\index.html"
img_path = r"C:\Users\DELL\.gemini\antigravity\brain\06d04a47-3b60-41c1-86a3-581c02393e61\media__1777106535106.jpg"

def trim_white(im):
    bg = Image.new(im.mode, im.size, (255,255,255))
    diff = ImageChops.difference(im, bg)
    diff = ImageChops.add(diff, diff, 2.0, -100)
    bbox = diff.getbbox()
    if bbox:
        return im.crop(bbox)
    return im

try:
    img = Image.open(img_path)
    if img.mode != 'RGB':
        img = img.convert('RGB')
    
    # 1. Very aggressive crop to remove any border box
    margin = 40
    w, h = img.size
    img = img.crop((margin, margin, w - margin, h - margin))
    
    # 2. Smart trim white space
    img = trim_white(img)
    
    # 3. Buffer to base64
    buffered = io.BytesIO()
    img.save(buffered, format="JPEG", quality=95)
    b64_content = base64.b64encode(buffered.getvalue()).decode("utf-8")
    data_uri = f'data:image/jpeg;base64,{b64_content}'

except Exception as e:
    print(f"Error processing image: {e}")
    sys.exit(1)

with open(html_path, "r", encoding="utf-8") as f:
    text = f.read()

# 4. Replacement (Direct string indexing for reliability)
# Find the login img tag
tag_search_str = 'alt="KP TECH Logo" className="w'
pos = text.find(tag_search_str)
if pos != -1:
    img_start = text.rfind('<img', 0, pos)
    img_end = text.find('/>', pos) + 2
    new_tag = f'<img src="{data_uri}" alt="KP TECH Logo" className="w-32 h-auto object-contain mb-4" onError={{(e) => e.target.style.display=\'none\'}} />'
    text = text[:img_start] + new_tag + text[img_end:]

# 5. Sidebar rewrite
sidebar_start_marker = 'w-40 h-10 bg-white rounded-xl' # or whatever it is now
pos_s = text.find(sidebar_start_marker)
if pos_s != -1:
    div_start = text.rfind('<div', 0, pos_s)
    div_end = text.find('</div>', pos_s) + 6
    new_sidebar = f'''
<div className="w-32 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/30 overflow-hidden border border-gray-100 p-1 px-2">
    <img src="{data_uri}" alt="KP TECH Logo" className="w-full h-full object-contain" onError={{(e) => {{ e.target.style.display='none'; e.target.nextSibling.style.display='block'; }}}} />
    <Icons.Shield className="text-gray-900 w-6 h-6 hidden" />
</div>
'''.strip()
    text = text[:div_start] + new_sidebar + text[div_end:]

with open(html_path, "w", encoding="utf-8") as f:
    f.write(text)

print("Final aggressive crop and w-32 size reduction applied.")
