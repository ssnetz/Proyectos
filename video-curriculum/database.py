from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class Alumno(db.Model):
    __tablename__ = "alumnos"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    apellido = db.Column(db.String(100), nullable=False)
    foto = db.Column(db.String(255), default="default.png")
    video_url = db.Column(db.String(500), nullable=False)
    habilidades = db.Column(db.Text, default="")
    linkedin = db.Column(db.String(255), default="")
    github = db.Column(db.String(255), default="")
    portfolio = db.Column(db.String(255), default="")
    descripcion = db.Column(db.Text, default="")
    curso = db.Column(db.String(100), default="")
    anio = db.Column(db.Integer, default=datetime.now().year)
    activo = db.Column(db.Boolean, default=True)
    creado = db.Column(db.DateTime, default=datetime.utcnow)

    def habilidades_lista(self):
        return [h.strip() for h in self.habilidades.split(",") if h.strip()]

    def nombre_completo(self):
        return f"{self.nombre} {self.apellido}"

    def embed_url(self):
        """Convierte URL de Google Drive o OneDrive a URL embebible."""
        url = self.video_url
        # Google Drive: .../file/d/FILE_ID/view -> embed
        if "drive.google.com" in url and "/view" in url:
            try:
                file_id = url.split("/d/")[1].split("/")[0]
                return f"https://drive.google.com/file/d/{file_id}/preview"
            except IndexError:
                pass
        # OneDrive embed
        if "onedrive.live.com" in url or "1drv.ms" in url:
            # OneDrive share link -> embed
            import urllib.parse
            encoded = urllib.parse.quote(url, safe="")
            return f"https://onedrive.live.com/embed?resid={encoded}"
        return url
