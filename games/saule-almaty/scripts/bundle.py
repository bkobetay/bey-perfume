"""Build an offline single-file game and a ZIP for sharing.
Usage: python3 bundle.py /path/to/output-folder
The external YouTube player still requires a network connection.
"""
from pathlib import Path
import base64
import re
import sys
import zipfile

root = Path(__file__).resolve().parents[1] / 'dist'
output = Path(sys.argv[1]).expanduser().resolve()
output.mkdir(parents=True, exist_ok=True)


def data_url(name):
    mime = 'image/png' if name.endswith('.png') else 'font/ttf'
    return 'data:' + mime + ';base64,' + base64.b64encode((root / name).read_bytes()).decode('ascii')


css = (root / 'style.css').read_text()
css = re.sub(r"url\('([^']+)'\)", lambda m: "url('" + data_url(m[1]) + "')", css)
game = (root / 'game.js').read_text()
for name in ['assets/golden-square-map.png', 'assets/saule-walk.png']:
    game = game.replace("'" + name + "'", "'" + data_url(name) + "'")
html = (root / 'index.html').read_text()
html = re.sub(r'<link rel="stylesheet" href="style\.css(?:\?[^\"]*)?">', lambda _: '<style>' + css + '</style>', html)
for name, script in [('map-data.js', (root / 'map-data.js').read_text()), ('game.js', game)]:
    html = re.sub(r'<script src="' + re.escape(name) + r'(?:\?[^\"]*)?" defer></script>', '', html)
    # Avoid closing an HTML script if source data ever contains that sequence.
    html = html.replace('</body>', '<script>' + script.replace('</script', '<\\/script') + '</script></body>')
filename = 'Сауле_Алматы.html'
(output / filename).write_text(html)
(output / 'Как_играть.txt').write_text('''САУЛЕ · ЗОЛОТОЙ КВАДРАТ АЛМАТЫ

Открой «Сауле_Алматы.html» в современном браузере.
Стрелки или WASD — идти. Shift или пробел — бежать. Escape — пауза.
На телефоне используй кнопки под картой.

Собери 12 звёзд и найди памятник Цою, парк Кунаева и дом-музей Ауэзова.
После завершения можно продолжить прогулку.

Карта использует реальные улицы и здания OpenStreetMap, © OpenStreetMap contributors, ODbL 1.0.
https://www.openstreetmap.org/copyright
Данные карты включены в HTML и доступны на условиях ODbL:
https://opendatacommons.org/licenses/odbl/1-0/
Карта — двумерная схема выбранного фрагмента центра Алматы и соседних кварталов.

Игра работает без интернета. Кнопка ♪ открывает музыкальную панель.
Официальный YouTube-плеер No Tears Left to Cry требует интернета и может быть недоступен.
Можно выбрать свой аудиофайл: он будет играть по кругу и не загрузится на сервер.
Песня не включена в архив. После обновления страницы свой файл нужно выбрать снова.
''')
(output / 'FONT-LICENSE.txt').write_bytes((root / 'assets' / 'FONT-LICENSE.txt').read_bytes())
with zipfile.ZipFile(output / 'Сауле_Алматы.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in [filename, 'Как_играть.txt', 'FONT-LICENSE.txt']:
        archive.write(output / name, arcname=name)
print(output / filename)
print(output / 'Сауле_Алматы.zip')
