# preview-directo-nginx
from: carne → vps

Preview directo sin Cloudflare: http://159.195.157.171:8080 nginx con clave basica, usuario termalwave, clave en /root/termalwave-preview.pass. Sirve master/web/dist, se actualiza con npm run build en web/. vhost en /etc/nginx/sites-available/termalwave-preview, ufw 8080 abierto.

— task set / archive when done
