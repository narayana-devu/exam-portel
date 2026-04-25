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
    
    # Aggressively crop margin to kill that black box line
    margin = 35
    w, h = img.size
    img = img.crop((margin, margin, w - margin, h - margin))
    
    # Auto-trim the whitespace
    img = trim_white(img)
    
    buffered = io.BytesIO()
    img.save(buffered, format="JPEG", quality=95)
    b64_content = base64.b64encode(buffered.getvalue()).decode("utf-8")
    data_uri = f'data:image/jpeg;base64,{b64_content}'

except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)

with open(html_path, "r", encoding="utf-8") as f:
    text = f.read()

# REPLACE LOGIN LOGO
# Look for the data:image/jpeg;base64,...alt="KP TECH Logo"
pattern = r'<img src="data:image/jpeg;base64,[^"]+" alt="KP TECH Logo" className="w-[^"]+" onError={{.*?}} />'
replacement = f'<img src="{data_uri}" alt="KP TECH Logo" className="w-36 h-auto object-contain mb-4" onError={{(e) => e.target.style.display=\'none\'}} />'
text = re.sub(pattern, replacement, text)

# REPLACE SIDEBAR WRAPPER
sidebar_pattern = r'<div className="w-48 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/30 overflow-hidden border border-gray-100 p-1 px-3">\s*<img src="data:image/jpeg;base64,[^"]+" alt="KP TECH Logo" className="w-full h-full object-contain" onError={{.*?}} />\s*<Icons\.Shield className="text-gray-900 w-6 h-6 hidden" />\s*</div>'
new_sidebar = f'''
<div className="w-32 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/30 overflow-hidden border border-gray-100 p-1 px-2">
    <img src="{data_uri}" alt="KP TECH Logo" className="w-full h-full object-contain" onError={{(e) => {{ e.target.style.display='none'; e.target.nextSibling.style.display='block'; }}}} />
    <Icons.Shield className="text-gray-900 w-6 h-6 hidden" />
</div>
'''.strip()
text = re.sub(sidebar_pattern, new_sidebar, text)

with open(html_path, "w", encoding="utf-8") as f:
    f.write(text)

print("Super-Aggressive crop and size reduction complete.")
