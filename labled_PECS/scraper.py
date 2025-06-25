from bs4 import BeautifulSoup
import requests
import os
import time
from urllib.parse import urljoin

BASE_URL = 'http://www.mypecs.com'
START_URL = 'http://www.mypecs.com/Search.aspx?catid=0&keywords='
DOWNLOAD_DIR = "/home/evil/Desktop/summer/pectogram/pectograms/labled_PECS/images"

# Configure session
session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Referer': BASE_URL
})

def ensure_download_dir():
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)

def download_image(img_url, img_title):
    try:
        response = session.get(img_url, stream=True, timeout=10)
        response.raise_for_status()
        
        # Determine file extension from Content-Type
        content_type = response.headers.get('content-type', '')
        if 'image/jpeg' in content_type:
            extension = '.jpg'
        elif 'image/png' in content_type:
            extension = '.png'
        elif 'image/gif' in content_type:
            extension = '.gif'
        else:
            # Fallback to URL extension
            extension = os.path.splitext(img_url)[1].split('?')[0].lower()
            if not extension or extension not in ['.jpg', '.jpeg', '.png', '.gif']:
                extension = '.jpg'
        
        filename = f"{img_title}{extension}"
        filepath = os.path.join(DOWNLOAD_DIR, filename)
        
        # Skip if already downloaded
        if os.path.exists(filepath):
            return False
            
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(1024):
                f.write(chunk)
        
        return True
    except Exception as e:
        print(f"Error downloading {img_url}: {str(e)}")
        return False

def process_page(soup, page_num):
    images = soup.select(".imgborder > a > img")
    print(f"Page {page_num}: Found {len(images)} images")
    
    downloaded = 0
    for img in images:
        img_url = img.get('src')
        if not img_url:
            continue
            
        img_url = urljoin(BASE_URL, img_url)
        parent_a = img.find_parent('a')
        img_title = parent_a.get('title', f'image_{int(time.time())}').strip()
        img_title = "".join(c for c in img_title if c.isalnum() or c in ('_', '-')).rstrip('_')
        
        if download_image(img_url, img_title):
            downloaded += 1
            print(f"Downloaded: {img_title}")
    
    return downloaded

def get_next_page_data(soup):
    return {
        '__VIEWSTATE': soup.find('input', {'id': '__VIEWSTATE'})['value'],
        '__VIEWSTATEGENERATOR': soup.find('input', {'id': '__VIEWSTATEGENERATOR'})['value'],
        '__EVENTVALIDATION': soup.find('input', {'id': '__EVENTVALIDATION'})['value'],
        '__EVENTTARGET': 'ctl00$ContentPlaceHolder1$aNext_bottom',
        '__EVENTARGUMENT': '',
        '__LASTFOCUS': '',
        'ctl00$ContentPlaceHolder1$ScriptManager1': 'ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$aNext_bottom',
        'ctl00_ContentPlaceHolder1_SearchResults1_ListView1_ClientState': '',
        'ctl00$ContentPlaceHolder1$SearchResults1$ListView1$ctl25$imgPageNext': 'Next'
    }

def scrape_all_pages(max_pages=39):
    ensure_download_dir()
    current_url = START_URL
    total_downloaded = 0
    page_num = 1
    
    while page_num <= max_pages:
        print(f"\nProcessing page {page_num}...")
        
        try:
            # Get initial page
            if page_num == 1:
                response = session.get(current_url)
            else:
                response = session.post(current_url, data=get_next_page_data(soup))
            
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Process images
            downloaded = process_page(soup, page_num)
            total_downloaded += downloaded
            
            # Check if we can continue
            next_button = soup.find('a', id='ContentPlaceHolder1_aNext_bottom')
            if not next_button:
                print("No more pages available")
                break
                
            page_num += 1
            time.sleep(2)  # Be polite
            
        except Exception as e:
            print(f"Error processing page {page_num}: {str(e)}")
            break

    print(f"\nFinished. Downloaded {total_downloaded} unique images from {page_num-1} pages.")

if __name__ == "__main__":
    scrape_all_pages()