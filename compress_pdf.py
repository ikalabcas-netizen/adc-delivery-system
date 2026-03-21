import os
import sys
import subprocess

pdf_path = r"D:\Vu Van Thanh\Hồ sơ cá nhân\Ho chieu\Hochieu.pdf"
out_path = r"D:\Vu Van Thanh\Hồ sơ cá nhân\Ho chieu\Hochieu_compressed.pdf"

if not os.path.exists(pdf_path):
    print("File not found:", pdf_path)
    folder = os.path.dirname(pdf_path)
    if os.path.exists(folder):
        print("Files in folder:", os.listdir(folder))
    else:
        print("Folder not found:", folder)
    sys.exit(1)

size = os.path.getsize(pdf_path) / (1024 * 1024)
print(f"Original size: {size:.2f} MB")

if size < 4.0:
    print("File is already under 4MB.")
    sys.exit(0)

try:
    import fitz
except ImportError:
    print("Installing PyMuPDF...")
    subprocess.run([sys.executable, "-m", "pip", "install", "PyMuPDF", "Pillow"], check=True)
    import fitz

doc = fitz.open(pdf_path)
doc.save(out_path, garbage=4, deflate=True, clean=True)
new_size = os.path.getsize(out_path) / (1024 * 1024)
print(f"Compressed size: {new_size:.2f} MB")

if new_size > 4.0:
    print("Basic compression not enough. Downscaling images...")
    try:
        from PIL import Image
    except ImportError:
        subprocess.run([sys.executable, "-m", "pip", "install", "Pillow"], check=True)
        from PIL import Image
    import io

    doc2 = fitz.open()
    for page in doc:
        pix = page.get_pixmap(dpi=150)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='JPEG', quality=65)
        
        new_page = doc2.new_page(width=page.rect.width, height=page.rect.height)
        new_page.insert_image(page.rect, stream=img_byte_arr.getvalue())
        
    doc2.save(out_path)
    final_size = os.path.getsize(out_path) / (1024 * 1024)
    print(f"Aggressively compressed size: {final_size:.2f} MB")
