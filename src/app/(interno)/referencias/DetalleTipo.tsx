import { Formulario, BotonAccion } from "@/components/Formulario";
import { Campo, Casilla, Rejilla, Selector, AreaTexto, Insignia, Vacio, aInputFechaHora, fecha, fechaHora } from "@/components/ui";
import type { catalogos } from "@/lib/catalogos";
import { TIPOS_SERVICIO_TRANSPORTE } from "@/lib/tipos";
import {
  agregarDuda,
  agregarUnidad,
  ajustarStock,
  cerrarDuda,
  guardarDetalle,
  marcarUnidad,
  programarDespacho,
  quitarUnidad,
} from "./actions";

type Cat = Awaited<ReturnType<typeof catalogos>>;
type Fila = Record<string, string | number | boolean | null>;
const val = (d: Fila | null, k: string) => (d?.[k] ?? null) as string | number | null;

export function FormCarga({ id, d, c, aerea, soloLectura }: { id: number; d: Fila | null; c: Cat; aerea: boolean; soloLectura: boolean }) {
  return (
    <Formulario accion={guardarDetalle.bind(null, id, "ref_carga")} soloLectura={soloLectura}>
      <Rejilla columnas={4}>
        <Campo name="booking" label="Booking" defaultValue={val(d, "booking")} />
        <Campo name="mbl" label={aerea ? "MAWB" : "MBL"} defaultValue={val(d, "mbl")} />
        <Campo name="hbl" label={aerea ? "HAWB" : "HBL"} defaultValue={val(d, "hbl")} />
        <Campo name="nave_viaje" label={aerea ? "Vuelo" : "Nave / viaje"} defaultValue={val(d, "nave_viaje")} />
        <Selector
          name="condicion"
          label="Condición"
          vacio={false}
          opciones={(aerea ? ["AEREO"] : ["FCL", "LCL"]).map((v) => ({ value: v, label: v }))}
          defaultValue={val(d, "condicion")}
        />
        <Campo name="puerto_origen" label="Origen" defaultValue={val(d, "puerto_origen")} />
        <Campo name="puerto_destino" label="Destino" defaultValue={val(d, "puerto_destino") ?? "CALLAO"} />
        <Selector name="terminal_id" label="Terminal" opciones={c.terminales} defaultValue={val(d, "terminal_id")} />
        <Campo name="manifiesto" label="Manifiesto" defaultValue={val(d, "manifiesto")} />
        <Campo name="etd" label="ETD" type="date" defaultValue={val(d, "etd")} />
        <Campo name="eta" label="ETA" type="date" defaultValue={val(d, "eta")} />
        <Campo name="fecha_zarpe" label="Zarpe real" type="date" defaultValue={val(d, "fecha_zarpe")} />
        <Campo name="fecha_llegada" label="Llegada real" type="date" defaultValue={val(d, "fecha_llegada")} />
        <Campo name="dias_libres" label="Días libres" type="number" defaultValue={val(d, "dias_libres")} />
        <Campo name="vencimiento_memo" label="Vence memo" type="date" defaultValue={val(d, "vencimiento_memo")} />
      </Rejilla>
    </Formulario>
  );
}

export function FormAduana({ id, d, soloLectura }: { id: number; d: Fila | null; soloLectura: boolean }) {
  return (
    <Formulario accion={guardarDetalle.bind(null, id, "ref_aduana")} soloLectura={soloLectura}>
      <Rejilla columnas={4}>
        <Campo name="dam" label="DAM" defaultValue={val(d, "dam")} />
        <Campo name="ref_agente" label="Ref. agente" defaultValue={val(d, "ref_agente")} />
        <Campo name="regimen_aduanero" label="Régimen" defaultValue={val(d, "regimen_aduanero")} />
        <Selector
          name="canal"
          label="Canal"
          opciones={["VERDE", "NARANJA", "ROJO"].map((v) => ({ value: v, label: v }))}
          defaultValue={val(d, "canal")}
        />
        <Campo name="fecha_numeracion" label="Numeración" type="datetime-local" defaultValue={aInputFechaHora(val(d, "fecha_numeracion") as string)} />
        <Campo name="fecha_pago_derechos" label="Pago de derechos" type="date" defaultValue={val(d, "fecha_pago_derechos")} />
        <Campo name="fecha_levante" label="Levante" type="datetime-local" defaultValue={aInputFechaHora(val(d, "fecha_levante") as string)} />
        <Campo name="invoice" label="Invoice" defaultValue={val(d, "invoice")} />
        <Campo name="valor_fob" label="FOB USD" type="number" step="0.01" defaultValue={val(d, "valor_fob")} />
        <Campo name="valor_cif" label="CIF USD" type="number" step="0.01" defaultValue={val(d, "valor_cif")} />
        <Campo name="derechos_usd" label="Derechos USD" type="number" step="0.01" defaultValue={val(d, "derechos_usd")} />
      </Rejilla>
    </Formulario>
  );
}

type Duda = { id: number; numero_notificacion: string | null; descripcion: string | null; plazo_respuesta: string | null; estado: string };

export function Dudas({ id, dudas, escribe }: { id: number; dudas: Duda[]; escribe: boolean }) {
  const hoy = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-3">
      {dudas.length === 0 ? (
        <Vacio>Sin dudas razonables.</Vacio>
      ) : (
        <ul className="divide-y divide-borde rounded-lg border border-borde">
          {dudas.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className="codigo">{x.numero_notificacion ?? "s/n"}</span>
              <span className="flex-1 text-tenue">{x.descripcion}</span>
              {x.plazo_respuesta && (
                <Insignia tono={x.estado === "abierta" && x.plazo_respuesta <= hoy ? "alerta" : "neutro"}>plazo {fecha(x.plazo_respuesta)}</Insignia>
              )}
              <Insignia tono={x.estado === "abierta" ? "aviso" : "apagado"}>{x.estado}</Insignia>
              {escribe && x.estado === "abierta" && <BotonAccion accion={cerrarDuda.bind(null, x.id, "respondida")}>Respondida</BotonAccion>}
              {escribe && x.estado === "respondida" && <BotonAccion accion={cerrarDuda.bind(null, x.id, "cerrada")}>Cerrar</BotonAccion>}
            </li>
          ))}
        </ul>
      )}
      {escribe && (
        <details className="rounded-lg border border-borde p-3">
          <summary className="cursor-pointer text-sm font-medium text-marca">+ Registrar duda razonable</summary>
          <Formulario accion={agregarDuda.bind(null, id)} limpiar className="mt-3">
            <Rejilla columnas={4}>
              <Campo name="numero_notificacion" label="N.º notificación" />
              <Campo name="fecha_recepcion" label="Recepción" type="date" />
              <Campo name="plazo_respuesta" label="Plazo de respuesta" type="date" />
              <Campo name="garantia" label="Garantía" />
            </Rejilla>
            <AreaTexto name="descripcion" label="Detalle" filas={2} />
          </Formulario>
        </details>
      )}
    </div>
  );
}

export function FormTransporte({ id, d, c, soloLectura }: { id: number; d: Fila | null; c: Cat; soloLectura: boolean }) {
  return (
    <Formulario accion={guardarDetalle.bind(null, id, "ref_transporte")} soloLectura={soloLectura}>
      <Rejilla columnas={4}>
        <Selector
          name="tipo_servicio"
          label="Servicio"
          vacio={false}
          opciones={Object.entries(TIPOS_SERVICIO_TRANSPORTE).map(([value, label]) => ({ value, label }))}
          defaultValue={val(d, "tipo_servicio")}
        />
        <Campo name="origen" label="Origen" defaultValue={val(d, "origen")} />
        <Campo name="destino" label="Destino" defaultValue={val(d, "destino")} />
        <Selector name="sede_destino_id" label="Sede de destino" opciones={c.sedes} defaultValue={val(d, "sede_destino_id")} />
        <Campo name="fecha_programada" label="Fecha programada" type="date" defaultValue={val(d, "fecha_programada")} />
        <Campo name="bultos" label="Bultos" type="number" defaultValue={val(d, "bultos")} />
      </Rejilla>
      <Casilla name="servicio_especial" label="Servicio especial (escolta, resguardo)" defaultChecked={Boolean(d?.servicio_especial)} />
      <AreaTexto name="observaciones" label="Observaciones" defaultValue={val(d, "observaciones") as string | null} filas={2} />
    </Formulario>
  );
}

type Unidad = {
  id: number;
  placa_tracto: string | null;
  placa_carreta: string | null;
  conductor: string | null;
  bultos: number | null;
  precinto: string | null;
  gre_remitente: string | null;
  gre_transportista: string | null;
  salida: string | null;
  llegada: string | null;
  contenedor: { numero: string } | null;
};

export function Unidades({
  id,
  unidades,
  contenedores,
  escribe,
}: {
  id: number;
  unidades: Unidad[];
  contenedores: { value: number; label: string }[];
  escribe: boolean;
}) {
  return (
    <div className="space-y-3">
      {unidades.length === 0 ? (
        <Vacio>Sin unidades asignadas.</Vacio>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {unidades.map((u) => (
            <li key={u.id} className="rounded-md border border-borde p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="codigo font-medium">
                  {u.placa_tracto ?? "—"}
                  {u.placa_carreta && <span className="text-tenue"> / {u.placa_carreta}</span>}
                </p>
                {escribe && (
                  <BotonAccion accion={quitarUnidad.bind(null, u.id)} confirmar="¿Quitar esta unidad?">
                    ×
                  </BotonAccion>
                )}
              </div>
              <p className="text-xs text-tenue">
                {u.conductor ?? "Sin conductor"} {u.bultos ? `· ${u.bultos} bultos` : ""} {u.contenedor ? `· ${u.contenedor.numero}` : ""}
              </p>
              <p className="codigo mt-1 text-[11px] text-tenue">
                {u.precinto && `precinto ${u.precinto} · `}
                {u.gre_remitente && `GRE-R ${u.gre_remitente} · `}
                {u.gre_transportista && `GRE-T ${u.gre_transportista}`}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {u.salida ? (
                  <span className="codigo text-slate-600">salió {fechaHora(u.salida)}</span>
                ) : (
                  escribe && <BotonAccion accion={marcarUnidad.bind(null, u.id, "salida")}>Marcar salida</BotonAccion>
                )}
                {u.llegada ? (
                  <span className="codigo text-marca">llegó {fechaHora(u.llegada)}</span>
                ) : (
                  escribe && u.salida && <BotonAccion accion={marcarUnidad.bind(null, u.id, "llegada")}>Marcar llegada</BotonAccion>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {escribe && (
        <details className="rounded-lg border border-borde p-3">
          <summary className="cursor-pointer text-sm font-medium text-marca">+ Asignar unidad</summary>
          <Formulario accion={agregarUnidad.bind(null, id)} limpiar className="mt-3">
            <Rejilla columnas={4}>
              <Campo name="placa_tracto" label="Placa tracto" />
              <Campo name="placa_carreta" label="Placa carreta" />
              <Campo name="conductor" label="Conductor" />
              <Campo name="bultos" label="Bultos" type="number" />
              <Selector name="contenedor_id" label="Contenedor" opciones={contenedores} />
              <Campo name="precinto" label="Precinto" />
              <Campo name="gre_remitente" label="GRE remitente" />
              <Campo name="gre_transportista" label="GRE transportista" />
            </Rejilla>
          </Formulario>
        </details>
      )}
    </div>
  );
}

export function FormAlmacenaje({ id, d, c, soloLectura }: { id: number; d: Fila | null; c: Cat; soloLectura: boolean }) {
  return (
    <Formulario accion={guardarDetalle.bind(null, id, "ref_almacenaje")} soloLectura={soloLectura}>
      <Rejilla columnas={3}>
        <Selector name="almacen_id" label="Almacén" opciones={c.almacenes} defaultValue={val(d, "almacen_id")} />
        <Selector name="producto_id" label="Producto" opciones={c.productos} defaultValue={val(d, "producto_id")} />
        <Campo name="fecha_ingreso" label="Fecha de ingreso" type="date" defaultValue={val(d, "fecha_ingreso")} />
        <Campo name="bultos_inicial" label="Bultos ingresados" type="number" min={0} defaultValue={val(d, "bultos_inicial")} />
        <Campo name="ubicacion" label="Ubicación" defaultValue={val(d, "ubicacion")} />
        <Campo name="m2_ocupados" label="m² ocupados" type="number" step="0.01" defaultValue={val(d, "m2_ocupados")} />
      </Rejilla>
    </Formulario>
  );
}

type Stock = { bultos_inicial: number; bultos_despachados: number; stock_actual: number; ultimo_retiro: string | null };
type Movimiento = { id: number; tipo: string; bultos: number; fecha: string; observacion: string | null };

export function Stock({
  id,
  stock,
  movimientos,
  c,
  equipo,
  escribe,
}: {
  id: number;
  stock: Stock | null;
  movimientos: Movimiento[];
  c: Cat;
  equipo: { value: string; label: string }[];
  escribe: boolean;
}) {
  const s = stock ?? { bultos_inicial: 0, bultos_despachados: 0, stock_actual: 0, ultimo_retiro: null };
  const pct = s.bultos_inicial ? Math.round((s.stock_actual / s.bultos_inicial) * 100) : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          ["Ingresó", s.bultos_inicial],
          ["Despachado", s.bultos_despachados],
          ["En stock", s.stock_actual],
        ].map(([t, v], i) => (
          <div key={t as string} className="rounded-md border border-borde p-3">
            <p className="text-[11px] tracking-wider text-tenue uppercase">{t}</p>
            <p className={`codigo text-2xl font-semibold ${i === 2 ? "text-marca" : ""}`}>{v}</p>
          </div>
        ))}
      </div>
      <div className="h-2 overflow-hidden rounded bg-slate-200">
        <div className="h-full bg-marca shadow-[0_0_12px_#22d3ee]" style={{ width: `${pct}%` }} />
      </div>

      {escribe && s.stock_actual > 0 && (
        <div className="rounded-lg border border-marca/40 bg-marca-claro p-3">
          <p className="mb-2 text-sm font-medium text-marca">Programar despacho (crea la referencia TRA y descuenta el stock)</p>
          <Formulario accion={programarDespacho.bind(null, id)} textoBoton="Programar despacho" limpiar>
            <Rejilla columnas={4}>
              <Campo name="bultos" label="Bultos" type="number" min={1} required />
              <Selector name="sede_destino_id" label="Sede de destino" opciones={c.sedes} />
              <Campo name="destino" label="Otro destino" />
              <Campo name="fecha_programada" label="Fecha" type="date" />
              <Campo name="placa_tracto" label="Placa tracto" />
              <Campo name="placa_carreta" label="Placa carreta" />
              <Campo name="conductor" label="Conductor" />
              <Selector name="responsable_id" label="Responsable TRA" opciones={equipo} />
            </Rejilla>
          </Formulario>
        </div>
      )}

      <div>
        <p className="etiqueta">Kardex</p>
        {movimientos.length === 0 ? (
          <Vacio>Sin movimientos.</Vacio>
        ) : (
          <ul className="divide-y divide-borde rounded-lg border border-borde text-sm">
            {movimientos.map((m) => (
              <li key={m.id} className="flex items-center gap-3 p-2.5">
                <span className="codigo w-32 text-xs text-tenue">{fechaHora(m.fecha)}</span>
                <span className="flex-1">{m.observacion ?? m.tipo}</span>
                <span className={`codigo ${m.bultos < 0 ? "text-slate-600" : "text-marca"}`}>
                  {m.bultos > 0 ? "+" : ""}
                  {m.bultos}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {escribe && (
        <details className="rounded-lg border border-borde p-3">
          <summary className="cursor-pointer text-sm text-tenue">Ajuste de inventario</summary>
          <Formulario accion={ajustarStock.bind(null, id)} limpiar boton="boton-secundario" className="mt-3">
            <div className="grid grid-cols-2 gap-3">
              <input name="bultos" type="number" placeholder="+5 o −3" className="campo" required />
              <input name="observacion" placeholder="Motivo" className="campo" />
            </div>
          </Formulario>
        </details>
      )}
    </div>
  );
}
