import os
from flask import Flask, render_template, request, redirect, url_for, flash, session
from werkzeug.utils import secure_filename
from werkzeug.security import check_password_hash, generate_password_hash
from database import db, Alumno
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "cambiar-en-produccion")
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///curricula.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["UPLOAD_FOLDER"] = os.path.join("static", "uploads")
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024  # 2 MB max para fotos

ADMIN_PASSWORD_HASH = generate_password_hash(os.getenv("ADMIN_PASSWORD", "admin123"))
EXTENSIONES_PERMITIDAS = {"png", "jpg", "jpeg", "webp"}

db.init_app(app)

with app.app_context():
    db.create_all()


def extension_permitida(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in EXTENSIONES_PERMITIDAS


def login_requerido(f):
    from functools import wraps
    @wraps(f)
    def decorador(*args, **kwargs):
        if not session.get("admin"):
            return redirect(url_for("admin_login"))
        return f(*args, **kwargs)
    return decorador


# ── Rutas públicas ──────────────────────────────────────────────

@app.route("/")
def index():
    anio = request.args.get("anio", type=int)
    curso = request.args.get("curso", "")
    query = Alumno.query.filter_by(activo=True)
    if anio:
        query = query.filter_by(anio=anio)
    if curso:
        query = query.filter_by(curso=curso)
    alumnos = query.order_by(Alumno.apellido).all()
    anios = db.session.query(Alumno.anio).distinct().order_by(Alumno.anio.desc()).all()
    cursos = db.session.query(Alumno.curso).distinct().order_by(Alumno.curso).all()
    return render_template(
        "index.html",
        alumnos=alumnos,
        anios=[a[0] for a in anios],
        cursos=[c[0] for c in cursos if c[0]],
        anio_sel=anio,
        curso_sel=curso,
    )


@app.route("/alumno/<int:alumno_id>")
def ver_alumno(alumno_id):
    alumno = Alumno.query.get_or_404(alumno_id)
    if not alumno.activo:
        return redirect(url_for("index"))
    return render_template("alumno.html", alumno=alumno)


# ── Rutas de administración ─────────────────────────────────────

@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    if request.method == "POST":
        password = request.form.get("password", "")
        if check_password_hash(ADMIN_PASSWORD_HASH, password):
            session["admin"] = True
            return redirect(url_for("admin_dashboard"))
        flash("Contraseña incorrecta.", "error")
    return render_template("admin/login.html")


@app.route("/admin/logout")
def admin_logout():
    session.pop("admin", None)
    return redirect(url_for("index"))


@app.route("/admin")
@login_requerido
def admin_dashboard():
    alumnos = Alumno.query.order_by(Alumno.apellido).all()
    return render_template("admin/dashboard.html", alumnos=alumnos)


@app.route("/admin/nuevo", methods=["GET", "POST"])
@login_requerido
def admin_nuevo():
    if request.method == "POST":
        foto_filename = "default.png"
        if "foto" in request.files:
            foto = request.files["foto"]
            if foto.filename and extension_permitida(foto.filename):
                foto_filename = secure_filename(foto.filename)
                foto.save(os.path.join(app.config["UPLOAD_FOLDER"], foto_filename))

        alumno = Alumno(
            nombre=request.form["nombre"].strip(),
            apellido=request.form["apellido"].strip(),
            foto=foto_filename,
            video_url=request.form["video_url"].strip(),
            habilidades=request.form.get("habilidades", ""),
            linkedin=request.form.get("linkedin", ""),
            github=request.form.get("github", ""),
            portfolio=request.form.get("portfolio", ""),
            descripcion=request.form.get("descripcion", ""),
            curso=request.form.get("curso", ""),
            anio=int(request.form.get("anio", 2026)),
        )
        db.session.add(alumno)
        db.session.commit()
        flash(f"Alumno {alumno.nombre_completo()} agregado correctamente.", "success")
        return redirect(url_for("admin_dashboard"))
    return render_template("admin/form.html", alumno=None)


@app.route("/admin/editar/<int:alumno_id>", methods=["GET", "POST"])
@login_requerido
def admin_editar(alumno_id):
    alumno = Alumno.query.get_or_404(alumno_id)
    if request.method == "POST":
        if "foto" in request.files:
            foto = request.files["foto"]
            if foto.filename and extension_permitida(foto.filename):
                foto_filename = secure_filename(foto.filename)
                foto.save(os.path.join(app.config["UPLOAD_FOLDER"], foto_filename))
                alumno.foto = foto_filename

        alumno.nombre = request.form["nombre"].strip()
        alumno.apellido = request.form["apellido"].strip()
        alumno.video_url = request.form["video_url"].strip()
        alumno.habilidades = request.form.get("habilidades", "")
        alumno.linkedin = request.form.get("linkedin", "")
        alumno.github = request.form.get("github", "")
        alumno.portfolio = request.form.get("portfolio", "")
        alumno.descripcion = request.form.get("descripcion", "")
        alumno.curso = request.form.get("curso", "")
        alumno.anio = int(request.form.get("anio", 2026))
        alumno.activo = "activo" in request.form
        db.session.commit()
        flash("Datos actualizados.", "success")
        return redirect(url_for("admin_dashboard"))
    return render_template("admin/form.html", alumno=alumno)


@app.route("/admin/eliminar/<int:alumno_id>", methods=["POST"])
@login_requerido
def admin_eliminar(alumno_id):
    alumno = Alumno.query.get_or_404(alumno_id)
    db.session.delete(alumno)
    db.session.commit()
    flash("Alumno eliminado.", "info")
    return redirect(url_for("admin_dashboard"))


if __name__ == "__main__":
    app.run(debug=True)
