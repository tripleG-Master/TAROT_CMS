const db = require("../db");

function connectorRows() {
  const tipos = ["intro", "pasado_presente", "presente_futuro", "cierre"];
  const polaridades = [
    "pos_pos",
    "pos_neg",
    "neg_pos",
    "neg_neg",
    "neutro"
  ];

  const templates = {
    intro: {
      neutro: [
        "Respira, {nombre}. Esta tirada revela un hilo que conecta lo que fue, lo que es y lo que puede ser.",
        "Vamos paso a paso, {nombre}: pasado, presente y futuro se ordenan para darte claridad.",
        "Con calma, {nombre}: estas tres cartas dibujan una guía para tu camino."
      ],
      pos_pos: [],
      pos_neg: [],
      neg_pos: [],
      neg_neg: []
    },
    pasado_presente: {
      pos_pos: [
        "Desde ese punto de partida, hoy se abre un camino más claro para {nombre}.",
        "Lo vivido te impulsó, y en el presente {nombre} siente que puede avanzar con decisión.",
        "Con esa base, el presente se vuelve una oportunidad real para ti."
      ],
      pos_neg: [
        "A pesar de ese impulso, hoy aparece un reto que te pide calma y enfoque, {nombre}.",
        "Aunque empezaste con fuerza, el presente trae una prueba que no conviene ignorar.",
        "Ese avance inicial contrasta con un presente que exige prudencia."
      ],
      neg_pos: [
        "Después de esa carga, hoy se presenta una salida más luminosa para {nombre}.",
        "Lo difícil quedó atrás y en el presente se activa una posibilidad de cambio real.",
        "Aun con lo vivido, el presente abre una puerta de alivio."
      ],
      neg_neg: [
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
      pos_pos: [
        "Si sostienes esta energía, el futuro tiende a consolidarse a tu favor.",
        "Este presente construye un futuro más estable para {nombre}.",
        "Manteniendo este enfoque, lo que viene se siente prometedor."
      ],
      pos_neg: [
        "Si no ajustas a tiempo, el futuro puede tensarse; aún estás a tiempo de corregir.",
        "Este buen momento puede cambiar si se descuidan detalles importantes.",
        "El futuro pide atención: no todo se mantiene solo."
      ],
      neg_pos: [
        "Si atraviesas este punto, el futuro se vuelve más amable y claro.",
        "Lo que hoy cuesta se transforma en aprendizaje y te abre un futuro mejor.",
        "Con constancia, el futuro puede darte una recompensa inesperada."
      ],
      neg_neg: [
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
      pos_pos: [
        "En resumen, estás preparad{o/a} para recibir lo que viene con confianza.",
        "Cierra este ciclo con gratitud: estás preparad{o/a} y con claridad.",
        "Tu camino se ordena: estás preparad{o/a} para dar el siguiente paso."
      ],
      neg_neg: [
        "En resumen, estás preparad{o/a} para poner límites y priorizarte desde hoy.",
        "Este cierre te recuerda: estás preparad{o/a} para soltar lo que ya no aporta.",
        "Aunque haya tensión, estás preparad{o/a} para actuar con firmeza."
      ],
      pos_neg: [
        "Cierra con atención: estás preparad{o/a} para ajustar el rumbo a tiempo.",
        "Aun con buenos recursos, estás preparad{o/a} para corregir y protegerte.",
        "Lo favorable existe, y estás preparad{o/a} para sostenerlo con disciplina."
      ],
      neg_pos: [
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
      for (const texto of list) rows.push({ tipo, polaridad: pol, perfil: "general", peso: 1, texto });
    }
  }
  return rows;
}

function messageRows() {
  const tonos = ["general", "empatico", "directo", "mistico"];
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
          polaridad: "neutra",
          sentido: "neutro",
          luz_sombra: "neutra",
          contenido: `[${arcano_id} · ${posicion} · ${perfil_tono}] {nombre}, esta carta señala una etapa ${posicion} que influye en tu camino. Estás preparad{o/a} para reconocerlo.`
        });
        rows.push({
          arcano_id,
          posicion,
          contexto,
          perfil_tono,
          polaridad: "neutra",
          sentido: "neutro",
          luz_sombra: "neutra",
          contenido: `[${arcano_id} · ${posicion} · ${perfil_tono}] Para {nombre}, el mensaje ${posicion} se manifiesta con claridad: confía en lo que sientes y actúa con intención. Estás preparad{o/a}.`
        });
      }
    }
  }
  return rows;
}

async function seedNarrativeData() {
  const { Connector, ArcanaMessage } = db.models;

  const existingConnectors = await Connector.findAll({
    attributes: ["tipo", "polaridad", "perfil", "texto"],
    raw: true
  });
  const connectorKey = (r) => `${r.tipo}|${r.polaridad}|${r.perfil}|${r.texto}`;
  const connectorSet = new Set(existingConnectors.map(connectorKey));
  const desiredConnectors = connectorRows();
  const missingConnectors = desiredConnectors.filter((r) => !connectorSet.has(connectorKey(r)));
  if (missingConnectors.length > 0) {
    await Connector.bulkCreate(missingConnectors);
  }

  const requiredArcanoIds = Array.from({ length: 22 }, (_, i) => i);
  const requiredPositions = ["pasado", "presente", "futuro"];

  const existingMessagePairs = await ArcanaMessage.findAll({
    attributes: ["arcano_id", "posicion", "contexto"],
    where: { arcano_id: requiredArcanoIds, contexto: "general", posicion: requiredPositions },
    raw: true
  });
  const pairKey = (r) => `${r.arcano_id}|${r.posicion}`;
  const pairSet = new Set(existingMessagePairs.map(pairKey));

  const missingMessages = [];
  for (const arcano_id of requiredArcanoIds) {
    for (const posicion of requiredPositions) {
      if (pairSet.has(`${arcano_id}|${posicion}`)) continue;
      missingMessages.push({
        arcano_id,
        posicion,
        contexto: "general",
        perfil_tono: "general",
        polaridad: "neutra",
        sentido: "neutro",
        luz_sombra: "neutra",
        contenido: `[seed · ${arcano_id} · ${posicion}] {nombre}, esta carta marca un punto ${posicion} que merece atención. Estás preparad{o/a}.`
      });
      missingMessages.push({
        arcano_id,
        posicion,
        contexto: "general",
        perfil_tono: "general",
        polaridad: "neutra",
        sentido: "neutro",
        luz_sombra: "neutra",
        contenido: `[seed · ${arcano_id} · ${posicion}] Para {nombre}, este mensaje ${posicion} te invita a actuar con claridad y calma. Estás preparad{o/a}.`
      });
    }
  }

  if (missingMessages.length > 0) {
    await ArcanaMessage.bulkCreate(missingMessages);
  }

  return {
    connectors: missingConnectors.length > 0 ? `inserted:${missingConnectors.length}` : "skipped",
    messages: missingMessages.length > 0 ? `inserted:${missingMessages.length}` : "skipped"
  };
}

module.exports = { seedNarrativeData };
