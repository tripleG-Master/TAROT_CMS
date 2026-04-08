const db = require("../db");

function connectorRows() {
  const tipos = ["pasado_presente", "presente_futuro", "cierre"];
  const polaridades = [
    "positivo_positivo",
    "positivo_negativo",
    "negativo_positivo",
    "negativo_negativo",
    "neutro"
  ];

  const templates = {
    pasado_presente: {
      positivo_positivo: [
        "Desde ese punto de partida, hoy se abre un camino más claro para {nombre}.",
        "Lo vivido te impulsó, y en el presente {nombre} siente que puede avanzar con decisión.",
        "Con esa base, el presente se vuelve una oportunidad real para ti."
      ],
      positivo_negativo: [
        "A pesar de ese impulso, hoy aparece un reto que te pide calma y enfoque, {nombre}.",
        "Aunque empezaste con fuerza, el presente trae una prueba que no conviene ignorar.",
        "Ese avance inicial contrasta con un presente que exige prudencia."
      ],
      negativo_positivo: [
        "Después de esa carga, hoy se presenta una salida más luminosa para {nombre}.",
        "Lo difícil quedó atrás y en el presente se activa una posibilidad de cambio real.",
        "Aun con lo vivido, el presente abre una puerta de alivio."
      ],
      negativo_negativo: [
        "Lo anterior deja huella, y en el presente {nombre} necesita recuperar control paso a paso.",
        "De esa etapa pesada se pasa a un presente que aún pide paciencia y límites claros.",
        "El pasado condiciona, y hoy conviene actuar con estrategia."
      ],
      neutro: [
        "Con ese antecedente, el presente se acomoda y te muestra el siguiente paso.",
        "Lo vivido prepara el terreno para lo que hoy se revela, {nombre}.",
        "Desde ahí, el presente toma forma con señales que conviene observar."
      ]
    },
    presente_futuro: {
      positivo_positivo: [
        "Si sostienes esta energía, el futuro tiende a consolidarse a tu favor.",
        "Este presente construye un futuro más estable para {nombre}.",
        "Manteniendo este enfoque, lo que viene se siente prometedor."
      ],
      positivo_negativo: [
        "Si no ajustas a tiempo, el futuro puede tensarse; aún estás a tiempo de corregir.",
        "Este buen momento puede cambiar si se descuidan detalles importantes.",
        "El futuro pide atención: no todo se mantiene solo."
      ],
      negativo_positivo: [
        "Si atraviesas este punto, el futuro se vuelve más amable y claro.",
        "Lo que hoy cuesta se transforma en aprendizaje y te abre un futuro mejor.",
        "Con constancia, el futuro puede darte una recompensa inesperada."
      ],
      negativo_negativo: [
        "Si sigues igual, el futuro prolonga el desgaste; es clave cambiar el enfoque.",
        "El futuro puede repetir patrones si hoy no se toma una decisión firme.",
        "Conviene cortar a tiempo para que lo que viene no pese más."
      ],
      neutro: [
        "Desde aquí, lo que viene depende de una elección consciente de {nombre}.",
        "El futuro queda abierto: la clave es cómo actúas desde hoy.",
        "Lo que sigue se define con pequeños movimientos sostenidos."
      ]
    },
    cierre: {
      positivo_positivo: [
        "En resumen, estás preparad{o/a} para recibir lo que viene con confianza.",
        "Cierra este ciclo con gratitud: estás preparad{o/a} y con claridad.",
        "Tu camino se ordena: estás preparad{o/a} para dar el siguiente paso."
      ],
      negativo_negativo: [
        "En resumen, estás preparad{o/a} para poner límites y priorizarte desde hoy.",
        "Este cierre te recuerda: estás preparad{o/a} para soltar lo que ya no aporta.",
        "Aunque haya tensión, estás preparad{o/a} para actuar con firmeza."
      ],
      positivo_negativo: [
        "Cierra con atención: estás preparad{o/a} para ajustar el rumbo a tiempo.",
        "Aun con buenos recursos, estás preparad{o/a} para corregir y protegerte.",
        "Lo favorable existe, y estás preparad{o/a} para sostenerlo con disciplina."
      ],
      negativo_positivo: [
        "Cierra con esperanza: estás preparad{o/a} para transformar esta etapa.",
        "Lo difícil pasa, y estás preparad{o/a} para reconstruir con calma.",
        "Hay salida: estás preparad{o/a} para elegir distinto."
      ],
      neutro: [
        "Cierra observando: estás preparad{o/a} para escuchar tu intuición.",
        "Lo más importante: estás preparad{o/a} para decidir con serenidad.",
        "Este cierre sugiere equilibrio: estás preparad{o/a} para avanzar sin prisa."
      ]
    }
  };

  const rows = [];
  for (const tipo of tipos) {
    for (const pol of polaridades) {
      const list = templates[tipo][pol] || [];
      for (const texto of list) rows.push({ tipo, polaridad: pol, texto });
    }
  }
  return rows;
}

function messageRows() {
  const tonos = ["empático", "directo", "místico"];
  const posiciones = ["pasado", "presente", "futuro"];
  const contexto = "general";

  const rows = [];
  for (let arcano_id = 0; arcano_id <= 21; arcano_id += 1) {
    for (const posicion of posiciones) {
      for (const perfil_tono of tonos) {
        rows.push({
          arcano_id,
          posicion,
          contexto,
          perfil_tono,
          contenido: `[${arcano_id} · ${posicion} · ${perfil_tono}] {nombre}, esta carta señala una etapa ${posicion} que influye en tu camino. Estás preparad{o/a} para reconocerlo.`
        });
        rows.push({
          arcano_id,
          posicion,
          contexto,
          perfil_tono,
          contenido: `[${arcano_id} · ${posicion} · ${perfil_tono}] Para {nombre}, el mensaje ${posicion} se manifiesta con claridad: confía en lo que sientes y actúa con intención. Estás preparad{o/a}.`
        });
      }
    }
  }
  return rows;
}

async function seedNarrativeData() {
  const { Connector, ArcanaMessage } = db.models;

  const connectorCount = await Connector.count();
  if (connectorCount === 0) {
    await Connector.bulkCreate(connectorRows());
  }

  const messageCount = await ArcanaMessage.count();
  if (messageCount === 0) {
    await ArcanaMessage.bulkCreate(messageRows());
  }

  return {
    connectors: connectorCount === 0 ? "inserted" : "skipped",
    messages: messageCount === 0 ? "inserted" : "skipped"
  };
}

module.exports = { seedNarrativeData };
