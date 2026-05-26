export const metadata = {
  title: 'Política de Privacidad y Términos de Uso — Proxis',
  description: 'Cómo Proxis recopila, usa y protege tus datos personales.',
}

export default function PoliticaPrivacidadPage() {
  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      background: '#fafaf7', minHeight: '100vh', padding: '40px 20px',
    }}>
      <div style={{ maxWidth: 740, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 6 }}>
            Pro<span style={{ color: '#cbf135', background: '#0b0a09', padding: '1px 3px', borderRadius: 3 }}>xis</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: '#0b0a09', margin: '12px 0 8px' }}>
            Política de Privacidad y Términos de Uso
          </h1>
          <p style={{ fontSize: 14, color: '#8a8885' }}>Versión 1.0 · Vigente desde el 26 de mayo de 2026</p>
        </div>

        <Section title="1. ¿Quiénes somos?">
          <p>
            Proxis es un sistema de coaching comercial basado en inteligencia artificial, desarrollado y operado por
            The Precision Selling SpA (en adelante, <strong>«Proxis»</strong>). Atendemos a organizaciones de ventas
            que desean apoyar el desarrollo profesional de sus equipos mediante mensajes personalizados y análisis
            conductual.
          </p>
        </Section>

        <Section title="2. ¿Qué datos recopilamos?">
          <p>Al usar Sailor Mentor, recopilamos los siguientes datos:</p>
          <Table rows={[
            ['Identificación',      'Nombre completo y dirección de email'],
            ['Actividad comercial', 'Número de contactos realizados por semana, número de prospectos generados, reportes de actividad'],
            ['Resultados',          'Ingresos reportados mensualmente'],
            ['Perfil conductual',   'Respuestas al Instrumento de Evaluación TPS (cuestionario de 57 ítems, en 4 módulos)'],
            ['Interacción IA',      'Mensajes enviados y recibidos en Sailor, estado de lectura, respuestas ingresadas'],
            ['Dispositivo',         'Sistema operativo y token de notificaciones push (para envío de alertas)'],
          ]} />
          <p style={{ marginTop: 12 }}>
            <strong>No</strong> recopilamos datos de geolocalización, historial de navegación ni información de redes sociales.
          </p>
        </Section>

        <Section title="3. ¿Quién puede ver tus datos?">
          <p>El acceso a tus datos sigue estrictamente la jerarquía de tu organización:</p>
          <Table rows={[
            ['Tú',                 'Ves tus propios mensajes del coach, tu perfil conductual, tu progreso y tus metas'],
            ['Tu supervisor',      'Ve tu actividad semanal (contactos, prospectos), los mensajes que recibes del sistema y señales conductuales generales'],
            ['Equipo Proxis (admin)', 'Acceso completo al sistema para operar, monitorear y mejorar el servicio — siempre bajo confidencialidad profesional'],
            ['La IA de Proxis',    'Procesa tus datos para generar mensajes personalizados de coaching. No transmite datos a terceros'],
          ]} />
          <p style={{ marginTop: 12 }}>
            Los asesores sin supervisor asignado solo son visibles para el equipo administrador de Proxis.
          </p>
        </Section>

        <Section title="4. ¿Para qué usamos tus datos?">
          <ul>
            <li>Generar mensajes de coaching personalizados según tu perfil conductual (Merrill-Reid / TPS)</li>
            <li>Detectar patrones de comportamiento que puedan impactar tus resultados comerciales</li>
            <li>Proveer a tu supervisor información suficiente para apoyarte mejor</li>
            <li>Mejorar el sistema mediante análisis agregados y anonimizados</li>
          </ul>
        </Section>

        <Section title="5. Lo que NO hacemos">
          <ul>
            <li><strong>No vendemos</strong> tus datos personales a terceros</li>
            <li><strong>No compartimos</strong> datos identificables fuera de tu organización sin tu consentimiento</li>
            <li><strong>No usamos</strong> tus datos para fines publicitarios ni perfilamiento comercial externo</li>
            <li><strong>No tomamos decisiones laborales automatizadas</strong> sobre tu persona — el sistema entrega información de apoyo, la decisión siempre corresponde a un humano</li>
          </ul>
        </Section>

        <Section title="6. Bases legales del tratamiento">
          <p>
            Tratamos tus datos sobre la base de tu <strong>consentimiento expreso</strong> (entregado al aceptar este
            documento) y del <strong>interés legítimo</strong> de tu organización en el desarrollo de su equipo comercial,
            conforme a la Ley N.º 19.628 sobre Protección de la Vida Privada (Chile) y normas aplicables en los países
            donde operamos.
          </p>
        </Section>

        <Section title="7. Seguridad de los datos">
          <ul>
            <li>Datos almacenados en servidores de <strong>Supabase</strong> (región us-east-1, certificación SOC 2)</li>
            <li>Todas las comunicaciones cifradas con <strong>TLS 1.3</strong></li>
            <li>Contraseñas almacenadas con <strong>bcrypt</strong> (nunca en texto claro)</li>
            <li>Acceso a la base de datos restringido por roles y Row Level Security</li>
            <li>Tokens de sesión con expiración de 30 días</li>
          </ul>
        </Section>

        <Section title="8. Retención de datos">
          <p>
            Conservamos tus datos mientras estés activo en el programa. Si abandonas el programa, tus datos permanecen
            en el sistema durante <strong>90 días</strong> adicionales y luego son eliminados o anonimizados, salvo que
            solicites eliminación inmediata (ver sección 9).
          </p>
        </Section>

        <Section title="9. Tus derechos">
          <p>Tienes derecho a:</p>
          <ul>
            <li><strong>Acceder</strong> a todos los datos que guardamos sobre ti</li>
            <li><strong>Rectificar</strong> datos incorrectos</li>
            <li><strong>Eliminar</strong> todos tus datos personales (excepto los que la ley obligue a conservar)</li>
            <li><strong>Oponerte</strong> al tratamiento en cualquier momento, lo que implicará el término de tu participación en el programa</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            Para ejercer cualquiera de estos derechos, escribe a{' '}
            <a href="mailto:privacidad@theprecisionselling.com" style={{ color: '#1a56c4' }}>
              privacidad@theprecisionselling.com
            </a>
            . Responderemos en un plazo máximo de <strong>10 días hábiles</strong>.
          </p>
        </Section>

        <Section title="10. Cambios a esta política">
          <p>
            Podemos actualizar esta política periódicamente. Te notificaremos mediante Sailor Mentor cuando haya cambios
            materiales. El uso continuado de la plataforma tras la notificación constituye aceptación de la versión
            actualizada.
          </p>
        </Section>

        <div style={{
          marginTop: 48, padding: '20px 24px', background: '#fff',
          border: '1px solid #e8e6e3', borderRadius: 12,
          fontSize: 13, color: '#4a4844', lineHeight: 1.6,
        }}>
          <strong>Contacto:</strong> The Precision Selling SpA ·{' '}
          <a href="mailto:privacidad@theprecisionselling.com" style={{ color: '#1a56c4' }}>
            privacidad@theprecisionselling.com
          </a>
        </div>

      </div>
    </div>
  )
}

// ── Componentes internos ──────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0b0a09', letterSpacing: '-0.02em', marginBottom: 12 }}>
        {title}
      </h2>
      <div style={{ fontSize: 15, color: '#2b2926', lineHeight: 1.7 }}>
        {children}
      </div>
    </section>
  )
}

function Table({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ border: '1px solid #e8e6e3', borderRadius: 10, overflow: 'hidden', marginTop: 10 }}>
      {rows.map(([label, value], i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '180px 1fr',
          borderBottom: i < rows.length - 1 ? '1px solid #f0ede8' : 'none',
        }}>
          <div style={{ padding: '10px 16px', background: '#fafaf7', fontSize: 12, fontWeight: 700, color: '#4a4844', borderRight: '1px solid #f0ede8' }}>
            {label}
          </div>
          <div style={{ padding: '10px 16px', fontSize: 13, color: '#2b2926' }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  )
}
