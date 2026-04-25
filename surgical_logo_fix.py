import base64
import re
import sys
from PIL import Image, ImageChops
import io

html_path = r"c:\Users\DELL\Downloads\portel-master (2)\portel-master\client\index.html"
img_path = r"C:\Users\DELL\.gemini\antigravity\brain\06d04a47-3b60-41c1-86a3-581c02393e61\media__1777106535106.jpg"

def trim_white_tight(im):
    # Find active pixels (non-white)
    bg = Image.new(im.mode, im.size, (255,255,255))
    diff = ImageChops.difference(im, bg)
    # Increase sensitivity to catch gray lines
    diff = ImageChops.add(diff, diff, 2.0, -50)
    bbox = diff.getbbox()
    if bbox:
        # Bbox is (left, top, right, bottom)
        # We manually add back a tiny 1px margin so nothing is chopped
        l, t, r, b = bbox
        return im.crop((l-1, t-1, r+1, b+1))
    return im

try:
    img = Image.open(img_path)
    if img.mode != 'RGB':
        img = img.convert('RGB')
    
    # 1. Surgical crop: The image is only 200x135. 
    # A 40px margin was 20% of the image! 
    # We only need to remove the outermost 3 pixels to kill the black box.
    margin = 3
    w, h = img.size
    img = img.crop((margin, margin, w - margin, h - margin))
    
    # 2. Tight trim to content
    img = trim_white_tight(img)
    
    buffered = io.BytesIO()
    img.save(buffered, format="JPEG", quality=100)
    b64_content = base64.b64encode(buffered.getvalue()).decode("utf-8")
    data_uri = f'data:image/jpeg;base64,{b64_content}'

except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)

with open(html_path, "r", encoding="utf-8") as f:
    text = f.read()

# Replace ANY logo img tag
pattern = r'<img src="data:image/jpeg;base64,[^"]+" alt="KP TECH Logo" className="w-[^"]+" onError={{.*?}} />'
replacement = f'<img src="{data_uri}" alt="KP TECH Logo" className="w-48 h-auto object-contain mb-4" onError={{(e) => e.target.style.display=\'none\'}} />'
text = re.sub(pattern, replacement, text)

# Sidebar
sidebar_pattern = r'<div className="w-(?:32|40|48) h-(?:10|12) bg-white rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/30 overflow-hidden border border-gray-100 p-1 px-2">\s*<img src="data:image/jpeg;base64,[^"]+" alt="KP TECH Logo" className="w-full h-full object-contain" onError={{.*?}} />\s*<Icons\.Shield className="text-gray-900 w-6 h-6 hidden" />\s*</div>'
new_sidebar = f'''
<div className="w-40 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/30 overflow-hidden border border-gray-100 p-1 px-3">
    <img src="{data_uri}" alt="KP TECH Logo" className="w-full h-full object-contain" onError={{(e) => {{ e.target.style.display='none'; e.target.nextSibling.style.display='block'; }}}} />
    <Icons.Shield className="text-gray-900 w-6 h-6 hidden" />
</div>
'''.strip()
text = re.sub(sidebar_pattern, new_sidebar, text)

with open(html_path, "w", encoding="utf-8") as f:
    f.write(text)

print("Surgical crop applied. Logo restoration complete.")
