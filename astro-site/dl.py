import urllib.request
req = urllib.request.Request(
    'https://upload.wikimedia.org/wikipedia/en/5/52/McMaster_University_logo.svg', 
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
)
with urllib.request.urlopen(req) as response:
    content = response.read()
    with open('public/Media/mcmaster_logo.svg', 'wb') as f:
        f.write(content)
print('Done!')
