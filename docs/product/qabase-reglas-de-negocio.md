# QABase — Reglas de negocio, alcance funcional y funcionamiento

> Documento de producto y arquitectura. Las secciones 0 a 13 describen el negocio, las reglas funcionales y el alcance. La sección 14 recoge las decisiones de arquitectura, datos y backend adoptadas para que el sistema pueda crecer por módulos. No se incluyen decisiones de diseño visual, UX ni metodología de desarrollo.
>
> La versión revisada incluye el módulo de **Mesa de Ayuda**, además de los módulos originales de Personal QA, Méritos e Incidencias, Identidad y Roles.
>
> El producto se llama **QABase** en el repositorio, la interfaz y la base de datos. El archivo por defecto es `data/qabase.sqlite`.

---

## 0. Resumen para contexto

QABase es un panel local para el equipo de QA. Sirve para cuatro cosas:

1. **Mantener un catálogo confiable del Personal QA**, con altas, cambios de nombre, desactivación y reactivación, sin perder nunca el historial.
2. **Registrar méritos e incidencias** de cada persona del catálogo, con fecha del hecho, tipo, nivel de impacto y detalle, conservando la trazabilidad de cada cambio y de cada anulación.
3. **Consultar y resumir** esos registros con filtros, totales separados por tipo y una tabla por QA, sin saldo neto y sin rankings de desempeño.
4. **Acercar la Mesa de Ayuda al equipo**: mantener una copia local consultable de los tickets del solicitante institucional y permitir reportar tickets rápidos con valores predeterminados.

Principios que atraviesan todo el producto:

- **Nada se borra.** No hay borrado físico de personas, registros, cuentas, roles ni tickets. Se desactiva, se anula o se conserva.
- **La persona no es la cuenta.** Un QA es una persona evaluada; una cuenta es un acceso al sistema. No se crean juntos ni se sincronizan automáticamente.
- **Todo cambio deja rastro.** Las altas, ediciones, cambios de estado, anulaciones, cambios de permisos y reinicios de contraseña quedan en un historial de solo lectura.
- **Los permisos mandan en el momento.** Cada acción se autoriza con los permisos vigentes del rol de la cuenta; una revocación surte efecto en la siguiente acción, sin necesidad de cerrar sesión.
- **Los números no se compensan.** Méritos e incidencias se informan por separado. No existe saldo neto, compensación entre tipos ni clasificación de desempeño.
- **La Mesa de Ayuda institucional es la fuente de verdad de los tickets.** QABase guarda una copia local y permite reportar; no reemplaza al sistema institucional.
- **El producto es de uso local.** Está pensado para el equipo que trabaja en el mismo equipo donde está instalado, no para acceso remoto por red o Internet.

---

## 1. Propósito y problema que resuelve

El equipo de QA necesita dejar constancia ordenada de los hechos relevantes de su personal: aportes que merecen reconocimiento y desviaciones que deben quedar registradas. Cuando ese registro vive en hojas sueltas, mensajes o memoria, aparecen cuatro problemas:

- se pierde el detalle de lo ocurrido;
- no se puede saber quién cambió qué ni cuándo;
- los totales dejan de ser confiables;
- se mezclan opiniones de desempeño con hechos puntuales.

QABase resuelve eso con un registro único, reglas explícitas, permisos por rol y un historial que no se reescribe. Además, separa claramente:

- **el catálogo de personas** (quiénes son los QA);
- **los hechos** (qué mérito o incidencia se les atribuye);
- **los accesos** (quién puede ver, crear, editar, anular o auditar);
- **los tickets de soporte** (qué requerimientos se reportaron a la Mesa de Ayuda).

El producto no pretende evaluar personas ni calcular puntajes de desempeño. Solo registra hechos y los resume con reglas explícitas.

---

## 2. Alcance funcional

### 2.1 Módulos y navegación

| Módulo | Propósito | Acceso |
| --- | --- | --- |
| **Panel** | Pantalla de inicio. Muestra accesos directos únicamente a los módulos habilitados para la cuenta. No muestra métricas globales. | Toda cuenta autenticada. |
| **Méritos e incidencias** | Registro, consulta, edición, anulación e historial de hechos del Personal QA. Es el módulo principal. | Permiso para ver registros. Las demás acciones dependen de permisos específicos. |
| **Mesa de Ayuda** | Consulta de tickets sincronizados, descarga de anexos y reporte rápido de tickets. | Permiso para ver tickets. El reporte rápido exige permiso para crear tickets. |
| **Personal QA** | Catálogo de personas: altas, cambios de nombre, desactivación, reactivación e historial. | Permiso para gestionar Personal QA. |
| **Usuarios** | Cuentas de acceso, rol asignado, estado, restablecimiento de contraseña e historial. | Permiso para gestionar usuarios. |
| **Roles** | Roles del sistema y permisos concedidos a cada uno. | Permiso para gestionar roles. |

Los módulos se agrupan visualmente en:

- **Principales:** Panel, Méritos e Incidencias, Mesa de Ayuda.
- **Configuración:** Personal QA, Usuarios, Roles.

Reglas de navegación:

- **RN-NAV-01.** Una cuenta solo ve en el Panel y en la navegación los módulos para los que tiene permiso.
- **RN-NAV-02.** Si una cuenta intenta abrir directamente un módulo para el que no tiene permiso, el sistema muestra acceso denegado.
- **RN-NAV-03.** El Panel siempre está disponible para una cuenta autenticada, aunque no tenga ningún otro módulo habilitado. En ese caso se le indica que solicite a un administrador la revisión de sus permisos.
- **RN-NAV-04.** Ocultar un módulo en la navegación es una ayuda visual; la autorización real se decide en cada acción.

### 2.2 Dentro del alcance

- Catálogo de Personal QA con identidad estable, estados e historial.
- Registro de méritos e incidencias con fecha del hecho, tipo, nivel, detalle y estado.
- Anulación irreversible con motivo y confirmación.
- Consultas con rango de fechas, filtros combinables, orden, paginación y búsqueda de texto.
- Totales separados de cantidad y puntos por tipo, y resumen por QA.
- Historial de cambios de solo lectura para registros, personas, cuentas y roles.
- Cuentas de acceso, roles, permisos y sesiones.
- Protección del último administrador y del rol Administrador.
- Mesa de Ayuda: sincronización de tickets del solicitante institucional, copia local, anexos, consulta y reporte rápido.
- Auditoría de las operaciones que modifican datos.

### 2.3 Fuera del alcance

Quedan fuera por decisión de producto, no por olvido:

- **Respaldos y restauración.** La aplicación no crea copias de seguridad, no las restaura y no promete protección ante pérdida del disco. Esa gestión es externa y queda bajo responsabilidad del usuario.
- **Borrado físico.** No existe borrado de personas, registros, cuentas, roles, tickets ni eventos de historial.
- **Restauración de registros anulados.** La anulación es definitiva.
- **Saldo neto, compensación entre méritos e incidencias y rankings de desempeño.**
- **Exportación de datos** a hojas, archivos o reportes externos.
- **Notificaciones** por correo, mensajería o avisos automáticos.
- **Aprobaciones o flujos de validación** de méritos, incidencias o tickets.
- **Comentarios, adjuntos o conversaciones dentro de un registro de mérito o incidencia.**
- **Acceso por red local o Internet.** El producto está pensado para el propio equipo.
- **Multiempresa o multiorganización.** Es una instalación para un solo equipo.
- **Plugins o módulos cargados en caliente.**
- **Gestión del ciclo de vida de tickets de Mesa de Ayuda desde QABase.** No se editan, asignan, cierran ni comentan tickets desde el panel.
- **Vínculo automático entre tickets de Mesa de Ayuda y registros de méritos/incidencias o personas del catálogo.**
- **Cola offline de reporte de tickets.** La consulta local funciona sin conexión una vez sincronizada, pero el reporte rápido necesita que la Mesa de Ayuda acepte el ticket.
- **Auditoría de lecturas, inicios de sesión o intentos fallidos.** El historial registra cambios, no consultas.

> Los **anexos de Mesa de Ayuda sí están dentro del alcance**. La exclusión de adjuntos se refiere a los registros de méritos e incidencias, que no admiten archivos.

### 2.4 Actores

| Actor | Qué es | Qué puede hacer |
| --- | --- | --- |
| **Administrador** | Cuenta con rol Administrador protegido. | Todo lo que el producto permite: ver, crear, editar, anular y auditar registros; gestionar Personal QA, usuarios, roles y Mesa de Ayuda. |
| **Editor** | Cuenta con rol Editor. | Ver, crear y editar registros; ver tickets y reportar tickets. No anula ni consulta historial de registros. |
| **Consulta** | Cuenta con rol Consulta. | Ver registros, métricas, catálogo de QAs y tickets. No modifica nada. |
| **Rol personalizado** | Rol creado por un administrador. | Exactamente los permisos que se le concedan. Empieza sin permisos. |
| **Persona del Personal QA** | Persona del catálogo, sujeta de méritos e incidencias. | No inicia sesión por ser QA. Puede tener o no una cuenta, sin vínculo automático. |
| **Operador local** | Persona con acceso físico al equipo donde está instalado el producto. | Puede crear la primera cuenta administradora y reiniciar localmente la contraseña de una cuenta administradora. |
| **Personal de Mesa de Ayuda** | Analistas del sistema institucional. | No son usuarios de QABase. Atienden los tickets reportados o sincronizados. |

### 2.5 Glosario

- **QA / Personal QA:** persona del catálogo sobre la que se registran méritos e incidencias. Tiene un identificador estable aunque cambie de nombre o se desactive.
- **Registro:** hecho atribuido a un QA. Puede ser mérito o incidencia. Tiene fecha del hecho, nivel, detalle y estado.
- **Mérito:** hecho positivo o aporte del QA.
- **Incidencia:** hecho negativo, desviación o problema atribuido al QA.
- **Impacto / nivel:** valor entero de 1 a 5 que expresa la magnitud del hecho dentro de una escala fija por tipo.
- **Puntos:** suma de los niveles de impacto de los registros vigentes. No es un puntaje de desempeño ni un saldo.
- **Vigente:** registro activo, que cuenta en los totales y puede editarse o anularse.
- **Anulado:** registro que ya no cuenta, no se edita, no se restaura y no se elimina.
- **Catálogo:** conjunto de personas, niveles, roles o permisos que el sistema reconoce.
- **Historial:** secuencia cronológica de cambios de una entidad, con actor, momento y estado anterior/posterior.
- **Cuenta:** acceso al sistema con nombre de usuario, contraseña, rol y estado.
- **Rol:** conjunto de permisos. Una cuenta tiene exactamente un rol.
- **Permiso:** autorización concreta para una acción o consulta.
- **Ticket:** requerimiento registrado en la Mesa de Ayuda institucional.
- **Referencia:** identificador visible del ticket en la Mesa de Ayuda, con forma `R-` seguida de números.
- **Anexo:** archivo asociado a un ticket.
- **Sesión:** período durante el cual una cuenta autenticada puede usar el sistema.

---

## 3. Principios y reglas transversales

- **RN-GEN-01 — Uso local.** El producto está pensado para ejecutarse en el equipo del equipo de QA y usarse desde ese mismo entorno. No se expone a la red local ni a Internet. Las acciones que modifican datos solo se aceptan desde la propia aplicación local.
- **RN-GEN-02 — Sin borrado.** Ninguna entidad se elimina físicamente desde la aplicación. Las personas se desactivan, las cuentas se desactivan, los registros se anulan y los roles no se borran. Las referencias históricas se conservan.
- **RN-GEN-03 — Identidad estable.** Cada persona, registro, cuenta, rol y ticket conserva su identificador aunque cambie de nombre, estado o contenido. El nombre nunca sustituye al identificador para la trazabilidad.
- **RN-GEN-04 — Cambio y rastro juntos.** Todo cambio de méritos, Personal QA, cuentas y roles se guarda de forma conjunta con su evento de historial. No puede quedar un cambio de esas entidades sin rastro ni un rastro sin cambio. La sincronización de Mesa de Ayuda es la excepción conocida: actualiza la copia local sin generar un evento visible.
- **RN-GEN-05 — Historial de solo lectura.** El historial no se edita, no se borra y no se reordena desde la aplicación. Se muestra en orden cronológico, del evento más antiguo al más reciente.
- **RN-GEN-06 — Control de versión.** Las personas, los registros, las cuentas y el nombre de los roles se editan con un número de versión. Quien modifica debe partir de la versión vigente. Si otra persona modificó antes, la operación se rechaza y se debe recargar la información. Una versión vieja nunca sobrescribe cambios existentes. La edición del conjunto de permisos de un rol es la excepción: se rige por la regla de reemplazo y no exige versión.
- **RN-GEN-07 — Permisos vigentes.** Cada acción se autoriza con los permisos actuales del rol de la cuenta. No hay permisos por persona fuera del rol, no hay herencia entre roles y no hay reglas de denegación explícitas. Lo que no está concedido, está prohibido.
- **RN-GEN-08 — Persona y cuenta separadas.** Un QA no es una cuenta y una cuenta no es un QA. Crear, renombrar o desactivar uno no crea, renombra ni desactiva el otro.
- **RN-GEN-09 — Datos sensibles.** Las contraseñas nunca se muestran, no se devuelven en consultas y no aparecen en el historial. El historial tampoco expone secretos, credenciales ni información de sesión.
- **RN-GEN-10 — Fechas.** La **fecha del hecho** es una fecha de calendario sin hora (`AAAA-MM-DD`), interpretada en el calendario local del equipo donde corre la aplicación. Las **marcas del historial** son momentos exactos y se muestran en hora universal (UTC). No se mezclan ambos conceptos.
- **RN-GEN-11 — Sin juicio de desempeño.** El sistema informa hechos y totales, no evalúa personas. La tabla por QA es un desglose de datos, no un ranking. El nivel de impacto lo justifica una persona en el detalle; el sistema no asigna niveles automáticamente ni atribuye responsabilidad automática.
- **RN-GEN-12 — Datos previstos.** Solo se aceptan los datos declarados para cada operación. Cualquier dato adicional o no previsto se rechaza; no se ignora en silencio.
- **RN-GEN-13 — Recorte de textos.** Nombres, detalles, motivos y asuntos se validan después de quitar espacios al inicio y al final, y se guardan sin esos espacios. Las contraseñas no se recortan ni se normalizan.
- **RN-GEN-14 — Rechazo sin efectos.** Una operación rechazada no modifica datos ni crea eventos de historial. No hay cambios parciales visibles.
- **RN-GEN-15 — Mensajes claros.** Los errores de negocio se muestran como mensajes comprensibles para la persona usuaria. No se exponen detalles internos ni trazas técnicas.

---

## 4. Personal QA

### 4.1 Qué es

El catálogo de Personal QA es la lista de personas sobre las que se registran méritos e incidencias. Es independiente de las cuentas de acceso.

Cada persona conserva:

- un **identificador estable**;
- su **nombre completo**;
- su **estado**: activa o inactiva;
- su **versión** de edición;
- las fechas de alta y última actualización.

### 4.2 Reglas del catálogo

- **RN-QA-01.** El nombre completo es obligatorio. Se recorta antes de validar y debe tener entre 1 y 200 caracteres.
- **RN-QA-02.** Se permiten homónimos. Dos personas pueden llamarse exactamente igual y serán dos registros distintos, con identificadores distintos. El nombre no es una clave única.
- **RN-QA-03.** Toda persona nueva se crea **activa**.
- **RN-QA-04.** Cambiar el nombre conserva el identificador, los registros asociados y el historial. No crea una persona nueva.
- **RN-QA-05.** Se puede renombrar tanto a una persona activa como a una inactiva.
- **RN-QA-06.** Desactivar y reactivar es reversible. No exige motivo. No borra, no oculta registros y no altera el identificador.
- **RN-QA-07.** Desactivar a una persona no la elimina de los registros existentes, del historial, de los filtros ni del resumen por QA.
- **RN-QA-08.** Una persona inactiva no puede seleccionarse como destino de un **nuevo** registro ni de un **cambio de QA** en un registro existente.
- **RN-QA-09.** Una persona inactiva sí puede conservarse como QA de un registro existente cuando se corrigen otros campos. La edición del detalle, tipo, fecha o nivel no obliga a cambiarla.
- **RN-QA-10.** Añadir una persona al catálogo **no crea una cuenta de usuario** ni le asigna rol.
- **RN-QA-11.** Crear una cuenta de usuario **no crea una persona en el catálogo**.
- **RN-QA-12.** Toda operación del catálogo —alta, renombrado, activación, desactivación y consulta de historial— exige el permiso de gestión de Personal QA.
- **RN-QA-13.** Un cambio con una versión desactualizada se rechaza y no modifica el nombre ni el estado vigente.
- **RN-QA-14.** No existe borrado de personas. Una persona con registros no puede eliminarse; la vía es desactivarla.

### 4.3 Listado y búsqueda

- **RN-QA-15.** Por defecto, el listado muestra solo personas activas.
- **RN-QA-16.** Existe una opción explícita para **incluir inactivos**.
- **RN-QA-17.** La búsqueda es por nombre completo, por coincidencia parcial y sin distinguir mayúsculas de minúsculas.
- **RN-QA-18.** La búsqueda **conserva las tildes y la Ñ**. Buscar `munoz` no encuentra `Muñoz`; buscar `MUÑOZ` sí encuentra `Muñoz`.
- **RN-QA-19.** Los caracteres `%`, `_` y `\` se buscan como texto literal, no como comodines.
- **RN-QA-20.** El listado se ordena alfabéticamente por nombre, sin distinguir mayúsculas de minúsculas, y usa el identificador como desempate.
- **RN-QA-21.** El catálogo no tiene paginación: muestra todas las personas que cumplen el filtro.
- **RN-QA-22.** El listado muestra, por persona, nombre, identificador y estado. Las acciones disponibles son renombrar, desactivar o reactivar, y ver historial.

### 4.4 Ciclo de vida

```
Activa  ──desactivar──▶  Inactiva
   ▲                        │
   └──────reactivar─────────┘
```

- No hay un estado “eliminada”.
- La desactivación no cambia los registros históricos.
- La reactivación recupera la posibilidad de ser elegida para nuevos registros.
- El historial conserva cada activación y desactivación con su actor y momento.

### 4.5 Historial de una persona

El historial de una persona muestra, en orden cronológico:

- alta;
- cambios de nombre, con nombre anterior y posterior;
- desactivaciones;
- reactivaciones.

Cada evento identifica al actor, el momento y los valores antes y después. El historial es de solo lectura.

### 4.6 Catálogo inicial de Personal QA

La instalación inicial crea estas 21 personas, conservando las grafías originales:

| Identificador de origen | Nombre completo |
| --- | --- |
| 1 | Jhon Javier Cutipa Vargas |
| 2 | Bernardo Pari Choquehuanca |
| 3 | Cleber Vilca Lupacca |
| 4 | Cliver J. Sonco Clavedias |
| 5 | Edgar Amador Mamani Calsina |
| 6 | Erick Gonzalo Ccori Aragon |
| 7 | ALAIN ELWIN ROMAN VILCAPAZA |
| 8 | Aldo R. Lezama Phocco |
| 9 | RONALD JOSE CAIRA MAMANI |
| 10 | Maritza Natalia Villacorta Muñoz |
| 11 | Kephler Gomez Calizaya |
| 12 | Carlos Midwar Arque Mamani |
| 13 | David Ricardo Huarino Mamani |
| 14 | DAVID BRAHYA LAROTA PILCO |
| 15 | Joel Santos Gómez Alanoca |
| 16 | Percy Condori Yucra |
| 17 | William Vladimir Vilcapaza Choque |
| 18 | Yomara L. Quispe Alanoca |
| 19 | JESUS ANTONY ARRATIA CAMA |
| 20 | LUANE NICOLE SALAS CHOQUE |
| 21 | JHON EVER MARON PUMA |

Reglas del catálogo inicial:

- **RN-QA-23.** La entrada 22 se omite porque fue confirmada como duplicada.
- **RN-QA-24.** No se renumeran identificadores, no se fusionan homónimos y no se corrigen las grafías por iniciativa del sistema.
- **RN-QA-25.** Todos los QAs iniciales quedan activos.

### 4.7 Lo que Personal QA no hace

- No crea cuentas.
- No asigna roles.
- No calcula métricas propias.
- No elimina personas.
- No impide desactivar a alguien con registros; solo lo saca de nuevas asignaciones.
- No bloquea el renombrado por tener registros.

---

## 5. Escala de impacto

### 5.1 Escala de méritos

| Nivel | Etiqueta | Significado |
| --- | --- | --- |
| 1 | Menor | Aporte puntual de alcance reducido. |
| 2 | Moderado | Contribución útil para una tarea o entrega. |
| 3 | Relevante | Mejora importante o prevención de un problema significativo. |
| 4 | Alto | Contribución de gran impacto para el equipo o producto. |
| 5 | Excepcional | Contribución excepcional, con beneficio de gran alcance. |

### 5.2 Escala de incidencias

| Nivel | Etiqueta | Significado |
| --- | --- | --- |
| 1 | Menor | Desviación menor, de impacto limitado. |
| 2 | Moderado | Problema acotado que requiere corrección. |
| 3 | Relevante | Incumplimiento o problema con impacto significativo. |
| 4 | Alto | Hecho con impacto grave en una entrega, operación o servicio. |
| 5 | Crítico | Hecho de impacto crítico en la operación o servicio. |

### 5.3 Reglas de la escala

- **RN-ESC-01.** Existen exactamente dos tipos —mérito e incidencia— y cinco niveles por tipo: 10 combinaciones válidas.
- **RN-ESC-02.** Un nivel válido es un entero de 1 a 5. Se rechazan 0, 6, negativos, decimales y textos.
- **RN-ESC-03.** La escala es un catálogo fijo. No se edita desde la aplicación.
- **RN-ESC-04.** El mismo número tiene etiquetas y significados distintos según el tipo. El nivel 5 de un mérito es “Excepcional”; el nivel 5 de una incidencia es “Crítico”.
- **RN-ESC-05.** La elección del nivel la justifica una persona en el detalle del registro. El sistema no la deduce del texto.
- **RN-ESC-06.** No se asigna automáticamente nivel 5 por un hecho ocurrido en producción ni se atribuye responsabilidad automática a una persona.
- **RN-ESC-07.** Los “puntos” son la suma aritmética de los niveles. No hay ponderaciones distintas por tipo ni por nivel.

---

## 6. Registros de méritos e incidencias

### 6.1 Naturaleza y datos

Un registro es un hecho atribuido a una persona del catálogo. Contiene:

| Dato | Regla |
| --- | --- |
| **QA** | Persona del catálogo, identificada por su identificador estable. |
| **Tipo** | Mérito o incidencia. |
| **Fecha del hecho** | Fecha de calendario `AAAA-MM-DD`, válida y no futura. |
| **Nivel** | Entero de 1 a 5, coherente con el tipo. |
| **Detalle** | Texto explicativo, obligatorio, de 1 a 5000 caracteres después de recortar. |
| **Estado** | Vigente o anulado. |
| **Versión** | Número que cambia con cada modificación. |
| **Fechas de sistema** | Alta y última actualización. |
| **Datos de anulación** | Momento, actor y motivo, solo si está anulado. |

El registro no incluye adjuntos, comentarios, aprobaciones ni campos personalizados.

### 6.2 Creación

- **RN-REG-01.** Para crear un registro se exige un QA, un tipo, una fecha del hecho, un nivel y un detalle.
- **RN-REG-02.** El QA debe existir y estar **activo**. Un QA inactivo no puede recibir registros nuevos.
- **RN-REG-03.** La fecha inicial propuesta en el formulario es **hoy**, según el calendario local del navegador.
- **RN-REG-04.** La fecha del hecho puede ser pasada. No se impone un límite inferior.
- **RN-REG-05.** La fecha del hecho no puede ser futura. La validación definitiva la hace el sistema con el día local del equipo donde está instalada la aplicación.
- **RN-REG-06.** La fecha debe ser una fecha real del calendario. Se rechazan días inexistentes, meses fuera de rango y años con formato inválido.
- **RN-REG-07.** El detalle se recorta y debe quedar entre 1 y 5000 caracteres. Un detalle formado solo por espacios se rechaza.
- **RN-REG-08.** El nivel debe ser un entero de 1 a 5.
- **RN-REG-09.** El tipo debe ser mérito o incidencia.
- **RN-REG-10.** El registro nace **vigente**, con versión inicial 1.
- **RN-REG-11.** La creación exige el permiso de creación de registros.
- **RN-REG-12.** La creación deja un evento de historial con actor, momento y estado posterior.

### 6.3 Edición

- **RN-REG-13.** Un registro vigente puede cambiar cualquiera de sus cinco datos de negocio: QA, tipo, fecha, detalle y nivel.
- **RN-REG-14.** La edición exige al menos un dato modificable y la versión vigente del registro.
- **RN-REG-15.** La edición exige el permiso de edición de registros.
- **RN-REG-16.** Si se cambia el QA, el destino debe existir y estar activo.
- **RN-REG-17.** Si se conserva el QA actual —aunque esté inactivo— se permite corregir tipo, fecha, detalle o nivel.
- **RN-REG-18.** Cambiar el tipo de mérito a incidencia, o al contrario, es válido. El nivel sigue siendo un número de 1 a 5, pero pasa a leerse con la escala del nuevo tipo.
- **RN-REG-19.** La fecha editada mantiene las reglas de creación: fecha real, no futura y sin límite inferior.
- **RN-REG-20.** El detalle editado mantiene la regla de 1 a 5000 caracteres después de recortar.
- **RN-REG-21.** Un registro **anulado no se edita**. Cualquier intento se rechaza como conflicto.
- **RN-REG-22.** Una edición con versión desactualizada se rechaza y no reemplaza los cambios existentes.
- **RN-REG-23.** Cada edición deja un evento de historial con los valores anteriores y posteriores de los campos de negocio.
- **RN-REG-24.** El historial no cambia el pasado: conserva el estado anterior y el posterior tal como ocurrieron.

### 6.4 Anulación

- **RN-REG-25.** Solo se puede anular un registro **vigente**.
- **RN-REG-26.** La anulación exige un **motivo** obligatorio, recortado, de 1 a 1000 caracteres.
- **RN-REG-27.** La anulación exige **confirmación explícita** de la persona usuaria. Cancelar la confirmación no envía la operación ni cambia nada.
- **RN-REG-28.** La anulación exige el permiso de anulación de registros.
- **RN-REG-29.** La anulación exige la versión vigente del registro.
- **RN-REG-42.** La anulación no exige que el QA del registro esté activo; se puede anular un hecho histórico de una persona ya desactivada.
- **RN-REG-30.** La anulación es **irreversible**. No existe restauración, desanulación ni vuelta a vigente.
- **RN-REG-31.** Un registro anulado no se edita, no se borra y no se restaura.
- **RN-REG-32.** Un segundo intento de anulación se rechaza como conflicto y no crea otro evento.
- **RN-REG-33.** La anulación conserva el registro, su detalle y su historial, y añade motivo, actor y momento.
- **RN-REG-34.** La anulación deja un evento de historial con el estado anterior, el estado anulado, el motivo y el momento.
- **RN-REG-35.** Un registro anulado deja de contribuir a los totales y a la tabla por QA.
- **RN-REG-36.** Un registro anulado solo se muestra en el listado cuando se activa explícitamente la vista de anulados, y esa vista exige permiso de historial.

### 6.5 Estados del registro

```
Vigente  ──anular con motivo y confirmación──▶  Anulado
   │                                                │
   └── editar (con versión vigente)                 └── inmutable
```

- No hay otros estados.
- No se puede volver de Anulado a Vigente.
- No se puede eliminar en ningún estado.

### 6.6 Validaciones resumidas

| Dato | Obligatorio | Regla | Error de negocio |
| --- | --- | --- | --- |
| QA | Sí | Debe existir; para alta o cambio debe estar activo. | “Selecciona un QA activo.” |
| Tipo | Sí | `mérito` o `incidencia`. | “El tipo no es válido.” |
| Fecha del hecho | Sí | Fecha real `AAAA-MM-DD`; no futura; sin límite inferior. | “La fecha no es válida o no puede ser futura.” |
| Nivel | Sí | Entero de 1 a 5. | “El nivel debe estar entre 1 y 5.” |
| Detalle | Sí | 1 a 5000 caracteres tras recortar. | “El detalle es obligatorio o supera el máximo.” |
| Motivo de anulación | Solo al anular | 1 a 1000 caracteres tras recortar. | “El motivo es obligatorio o supera el máximo.” |
| Versión | Sí al editar o anular | Debe ser la vigente. | “El registro cambió; recarga antes de reintentar.” |

### 6.7 Ejemplos de negocio

- **Caso válido:** “Jhon Javier Cutipa Vargas”, mérito, fecha de ayer, nivel 3, detalle “Previno una regresión en la entrega”. Resultado: registro vigente, 1 mérito, 3 puntos de mérito.
- **Caso válido:** incidencia, fecha de hace un mes, nivel 2, detalle “Omitió una validación en la prueba de regresión”. Resultado: registro vigente, 1 incidencia, 2 puntos de incidencia.
- **Caso rechazado:** fecha de mañana. Resultado: no se crea nada.
- **Caso rechazado:** QA inactivo como destino. Resultado: no se crea ni se cambia el registro.
- **Caso rechazado:** detalle con solo espacios. Resultado: no se crea nada.
- **Caso rechazado:** nivel 0 o 6. Resultado: no se crea nada.
- **Caso rechazado:** editar un anulado. Resultado: conflicto; el registro sigue anulado.
- **Caso rechazado:** anular dos veces. Resultado: conflicto; no se duplica el evento.

### 6.8 Historial de un registro

El historial de un registro muestra, en orden cronológico:

- **Creación**, con el estado inicial.
- **Cada edición**, con los valores anteriores y posteriores de QA, tipo, fecha, detalle, nivel y estado.
- **Anulación**, con el motivo, el actor y el momento.

Reglas del historial:

- **RN-REG-37.** El historial es de solo lectura.
- **RN-REG-38.** Muestra el nombre de usuario del actor tal como era en el momento del evento.
- **RN-REG-39.** Identifica al QA por su identificador estable, no por el nombre, para que un cambio de nombre no altere la interpretación del pasado.
- **RN-REG-40.** No registra contraseñas, credenciales ni información de sesión.
- **RN-REG-41.** Consultar el historial de un registro exige permiso de historial además de permiso para ver registros.

---

## 7. Consultas, filtros y métricas

### 7.1 Rango de fechas

- **RN-CON-01.** Al abrir el módulo, la consulta inicia en el **mes local actual**, desde el primer hasta el último día del mes, ambos incluidos.
- **RN-CON-02.** Existen atajos para **Mes actual** y **Mes anterior**.
- **RN-CON-03.** Se puede definir un rango personalizado con **Desde** y **Hasta**.
- **RN-CON-04.** Se puede dejar un extremo vacío para un rango abierto: solo desde, solo hasta, ambos o ninguno.
- **RN-CON-05.** La opción **Todo el historial** elimina el rango de fechas y consulta todos los registros que cumplan los demás filtros.
- **RN-CON-06.** El rango es inclusivo: incluye los registros cuya fecha del hecho coincide con los extremos.
- **RN-CON-07.** Una fecha inválida o un rango invertido —desde posterior a hasta— se rechaza y no se consulta.
- **RN-CON-08.** Los filtros activos se conservan al recargar la pantalla.
- **RN-CON-09.** Al cambiar cualquier filtro, la consulta vuelve a la página 1.

### 7.2 Filtros

Se pueden combinar, todos a la vez:

- **QA**, incluidos los inactivos. El selector muestra a los inactivos con la etiqueta “(inactivo)”.
- **Tipo**: todos, méritos o incidencias.
- **Nivel**: todos o uno de 1 a 5.
- **Texto del detalle**.
- **Rango de fechas** o todo el historial.

Reglas:

- **RN-CON-10.** Los filtros se combinan con “y”: un registro debe cumplir todos los criterios para aparecer.
- **RN-CON-11.** El filtro por QA permite seleccionar personas inactivas para consultar su historia.
- **RN-CON-12.** El filtro por nivel no distingue el tipo; un nivel 5 puede corresponder a un mérito excepcional o a una incidencia crítica.
- **RN-CON-13.** Los filtros afectan tanto al listado como a los totales y a la tabla por QA.

### 7.3 Búsqueda de texto

- **RN-CON-14.** La búsqueda se aplica únicamente al **detalle** del registro.
- **RN-CON-15.** Es una coincidencia parcial: encuentra el texto en cualquier posición del detalle.
- **RN-CON-16.** No distingue mayúsculas de minúsculas, incluidos caracteres como Ñ y vocales con tilde.
- **RN-CON-17.** **Conserva las tildes y la Ñ.** Buscar `munoz` no encuentra `Muñoz`; buscar `MUÑOZ` sí encuentra `Muñoz`.
- **RN-CON-18.** Los caracteres `%`, `_` y `\` se buscan como texto literal, no como comodines.
- **RN-CON-19.** El texto se recorta antes de buscar.
- **RN-CON-20.** El texto vacío no filtra: equivale a “cualquier detalle”.

### 7.4 Orden del listado

- **RN-CON-21.** El listado se ordena por **fecha del hecho descendente**: primero los hechos más recientes.
- **RN-CON-22.** Si dos registros tienen la misma fecha del hecho, primero aparece el creado más recientemente.
- **RN-CON-23.** Si coinciden fecha del hecho y momento de creación, primero aparece el identificador mayor.
- **RN-CON-24.** El orden es estable y no depende del orden de carga ni del navegador.

### 7.5 Paginación

- **RN-CON-25.** Los tamaños de página permitidos son **25, 50 y 100**.
- **RN-CON-26.** El tamaño inicial es 25.
- **RN-CON-27.** La consulta comienza en la página 1.
- **RN-CON-28.** Cambiar el tamaño de página vuelve a la página 1.
- **RN-CON-29.** La paginación muestra el rango visible y el total de registros que cumplen los filtros.
- **RN-CON-30.** La paginación no altera los totales: los totales siempre se calculan sobre todos los resultados filtrados, no sobre la página visible.

### 7.6 Totales generales

Se informan cuatro cifras separadas:

1. Cantidad de méritos vigentes.
2. Puntos de méritos.
3. Cantidad de incidencias vigentes.
4. Puntos de incidencias.

Reglas:

- **RN-CON-31.** Los totales se calculan sobre **todos los registros vigentes que cumplen los filtros**, no solo sobre la página visible.
- **RN-CON-32.** Los puntos de méritos son la suma de los niveles de los méritos vigentes filtrados.
- **RN-CON-33.** Los puntos de incidencias son la suma de los niveles de las incidencias vigentes filtradas.
- **RN-CON-34.** **No existe saldo neto.** No se resta incidencias de méritos ni se compensa un tipo con el otro.
- **RN-CON-35.** Los registros anulados **nunca** entran en los totales, aunque se hayan incluido en el listado.
- **RN-CON-36.** Los totales se muestran con la aclaración de que corresponden a registros vigentes con los filtros aplicados.
- **RN-CON-37.** Ejemplo: 2 méritos de niveles 3 y 5, y 1 incidencia de nivel 2, producen “2 méritos, 8 puntos de mérito” y “1 incidencia, 2 puntos de incidencia”. No producen “6 de saldo”.
- **RN-CON-38.** Ejemplo: 26 méritos de nivel 1 que cumplen los filtros y una página de 25 muestran 25 filas, pero los totales informan 26 méritos y 26 puntos.

### 7.7 Resumen por QA

- **RN-CON-39.** La tabla por QA incluye **todo el catálogo**, activo o inactivo, aunque una persona no tenga resultados.
- **RN-CON-40.** Las personas sin resultados aparecen con cero en las cuatro cifras.
- **RN-CON-41.** La tabla se ordena alfabéticamente por nombre, sin distinguir mayúsculas de minúsculas.
- **RN-CON-42.** Las personas inactivas se identifican con una etiqueta textual “Inactivo”, no solo con color.
- **RN-CON-43.** La tabla muestra cantidad y puntos de méritos y cantidad y puntos de incidencias por persona.
- **RN-CON-44.** La tabla es un desglose de datos, no una clasificación de desempeño. No hay posiciones, medallas ni comparaciones.
- **RN-CON-45.** Los anulados no se incluyen en la tabla por QA.

### 7.8 Vista de anulados

- **RN-CON-46.** La opción “Incluir anulados” solo está disponible para cuentas con permiso de historial.
- **RN-CON-47.** Al activarla, el listado incluye registros anulados además de los vigentes.
- **RN-CON-48.** Las tarjetas de totales y la tabla por QA **siguen calculándose solo con vigentes**, aunque el listado muestre anulados.
- **RN-CON-49.** La pantalla advierte explícitamente de esa diferencia para que no se confundan listado y totales.
- **RN-CON-50.** Un registro anulado se muestra con estado “Anulado”; su motivo se conserva y se puede consultar en el historial.

### 7.9 Columnas y etiquetas del listado

El listado muestra:

| Columna | Contenido |
| --- | --- |
| Fecha | Fecha del hecho, `AAAA-MM-DD`. |
| QA | Nombre vigente de la persona; si está inactiva, se añade “(inactivo)”. |
| Tipo | “Mérito” o “Incidencia”. |
| Nivel | Número y etiqueta de la escala del tipo, por ejemplo “3. Relevante”. |
| Detalle | Texto del hecho. |
| Estado | “Vigente” o “Anulado”. |
| Acciones | Editar, Anular y Ver historial, solo si la cuenta tiene el permiso correspondiente y el registro está vigente para editar/anular. |

Reglas:

- **RN-CON-51.** Un registro anulado no ofrece Editar ni Anular.
- **RN-CON-52.** Ver historial es de solo lectura y nunca abre un formulario de edición.
- **RN-CON-53.** Las acciones visibles se ajustan a los permisos de la cuenta, pero la autorización definitiva se aplica en cada operación.

---

## 8. Identidad, cuentas, roles y permisos

### 8.1 Cuentas de acceso

- **RN-ID-01.** No hay registro público. Las cuentas las crea un administrador o se crea la primera cuenta administradora durante la puesta en marcha local.
- **RN-ID-02.** Cada cuenta tiene exactamente **un rol**. No se acumulan roles por persona.
- **RN-ID-03.** Una cuenta tiene nombre de usuario, contraseña, rol, estado activo/inactivo y versión.
- **RN-ID-04.** El nombre de usuario es único sin distinguir mayúsculas de minúsculas. `Editor`, `editor` y `EDITOR` son el mismo nombre a efectos de unicidad.
- **RN-ID-05.** No se eliminan cuentas. Se desactivan.
- **RN-ID-06.** Una cuenta desactivada no puede iniciar sesión y sus sesiones abiertas dejan de ser válidas.
- **RN-ID-07.** Una cuenta activa puede cambiar de nombre, de rol o desactivarse.
- **RN-ID-08.** Cambiar el nombre de usuario no borra su historial; los eventos anteriores conservan el nombre que tenía el actor en ese momento.
- **RN-ID-09.** Una cuenta no puede desactivarse a sí misma.
- **RN-ID-10.** El **último administrador activo** no puede desactivarse ni cambiar de rol. Si se intenta, la operación se rechaza.
- **RN-ID-11.** La regla anterior protege la continuidad de la administración; si hay más de un administrador activo, uno de ellos puede cambiar de rol o ser desactivado, siempre que quede al menos uno.
- **RN-ID-12.** La creación, edición, desactivación, reactivación, restablecimiento de contraseña y consulta de historial de cuentas exige permiso de gestión de usuarios.
- **RN-ID-13.** Gestionar usuarios permite crear cuentas y asignar cualquier rol existente, **salvo el rol Administrador**. Conceder el rol Administrador exige además el permiso de gestionar roles. La pantalla de Usuarios refleja esta regla: el selector de rol oculta Administrador a quien no pueda concederlo.

### 8.2 Nombre de usuario

- **RN-ID-14.** Debe tener entre 3 y 64 caracteres.
- **RN-ID-15.** Solo admite letras ASCII, números, punto, guion y guion bajo: `A-Z`, `a-z`, `0-9`, `.`, `-`, `_`.
- **RN-ID-16.** No admite espacios, tildes, Ñ, arrobas ni otros símbolos.
- **RN-ID-17.** No se recorta: un espacio al inicio o al final hace inválido el nombre.
- **RN-ID-18.** La unicidad no distingue mayúsculas de minúsculas.

### 8.3 Contraseña

- **RN-ID-19.** Debe tener entre 12 y 128 caracteres.
- **RN-ID-20.** No se recorta ni se normaliza: los espacios cuentan y deben escribirse exactamente.
- **RN-ID-21.** Se almacena protegida y nunca se muestra, devuelve ni registra en el historial.
- **RN-ID-22.** Al crear una cuenta, el administrador define la contraseña inicial.
- **RN-ID-23.** Al restablecer una contraseña, el administrador define una nueva; no se puede “ver” la anterior.
- **RN-ID-24.** Una persona puede cambiar su propia contraseña indicando la actual y la nueva.
- **RN-ID-25.** El cambio de contraseña propio cierra las demás sesiones de la cuenta, pero mantiene la sesión desde la que se hizo el cambio.
- **RN-ID-26.** El restablecimiento administrativo cierra **todas** las sesiones de la cuenta afectada.
- **RN-ID-27.** No existe recuperación de contraseña desde la pantalla de inicio de sesión.

### 8.4 Inicio de sesión y sesiones

- **RN-ID-28.** El inicio de sesión usa nombre de usuario y contraseña.
- **RN-ID-29.** Ante usuario inexistente o contraseña incorrecta, el mensaje es el mismo: “Usuario o contraseña incorrectos”. No se revela si la cuenta existe.
- **RN-ID-30.** Se permiten como máximo **cinco intentos fallidos** por nombre de usuario normalizado dentro de una ventana de **quince minutos**.
- **RN-ID-31.** El sexto intento dentro de la ventana se rechaza con un aviso de “demasiados intentos”; no se evalúa la contraseña.
- **RN-ID-32.** El conteo se lleva por nombre normalizado, de modo que las variantes de mayúsculas/minúsculas comparten el mismo límite.
- **RN-ID-33.** Un inicio de sesión exitoso limpia el conteo de fallos de esa cuenta.
- **RN-ID-34.** El bloqueo de una cuenta no afecta a las demás.
- **RN-ID-35.** El límite de intentos no se conserva entre reinicios del servicio: al reiniciar, el conteo vuelve a cero. Es una limitación operativa conocida.
- **RN-ID-36.** La sesión tiene una duración máxima absoluta de **8 horas**. No se renueva indefinidamente por actividad.
- **RN-ID-37.** La sesión no sobrevive al cierre del navegador.
- **RN-ID-38.** Cerrar sesión invalida la sesión actual.
- **RN-ID-39.** Desactivar una cuenta invalida sus sesiones.
- **RN-ID-40.** Restablecer la contraseña invalida las sesiones de la cuenta.
- **RN-ID-41.** Cambiar el rol o los permisos **no** cierra la sesión; el cambio se aplica en la siguiente acción.
- **RN-ID-42.** Si una cuenta desactivada intenta usar una sesión anterior, la petición se rechaza y la sesión deja de ser válida.

### 8.5 Roles

- **RN-ID-43.** El sistema parte con tres roles: **Administrador**, **Editor** y **Consulta**.
- **RN-ID-44.** Un administrador puede crear roles nuevos.
- **RN-ID-45.** Un rol nuevo empieza **sin permisos**. Después se le conceden.
- **RN-ID-46.** El nombre de un rol es obligatorio, se recorta y debe tener entre 1 y 100 caracteres.
- **RN-ID-47.** El nombre de un rol no puede repetirse exactamente. La comparación de duplicados distingue mayúsculas de minúsculas.
- **RN-ID-48.** Un rol no se elimina.
- **RN-ID-49.** Un rol no protegido puede renombrarse.
- **RN-ID-50.** Los permisos de un rol no protegido se editan como un conjunto: al guardar, la selección reemplaza por completo a la anterior. La operación no exige versión; si dos personas editan permisos a la vez, prevalece la última en guardar.
- **RN-ID-51.** El rol **Administrador** es protegido:
  - no se puede renombrar;
  - no se pueden editar sus permisos;
  - implica **todos** los permisos conocidos, presentes y futuros;
  - no puede quedar sin administradores activos.
- **RN-ID-52.** No se puede crear otro rol protegido desde la aplicación.
- **RN-ID-53.** Un rol con cuentas asignadas no se puede borrar; de hecho, ningún rol se borra.
- **RN-ID-54.** Cambiar los permisos de un rol afecta a todas las cuentas que lo tienen, en su siguiente acción.

### 8.6 Catálogo de permisos

El producto reconoce diez capacidades:

| Capacidad | Qué permite |
| --- | --- |
| **Ver registros** | Consultar registros, filtros, totales, resumen por QA, catálogo de niveles y opciones de QAs. |
| **Crear registros** | Registrar méritos e incidencias. |
| **Editar registros** | Modificar registros vigentes. |
| **Anular registros** | Anular registros vigentes con motivo y confirmación. |
| **Ver historial de registros** | Consultar el historial de un registro y activar la vista de anulados. |
| **Gestionar Personal QA** | Crear, renombrar, activar, desactivar y consultar el historial del catálogo. |
| **Gestionar usuarios** | Crear, editar, activar, desactivar, restablecer contraseñas y consultar el historial de cuentas. |
| **Gestionar roles** | Crear roles, renombrarlos, cambiar sus permisos y consultar su historial. |
| **Ver Mesa de Ayuda** | Consultar tickets, ver detalles, descargar anexos y sincronizar. |
| **Crear tickets de Mesa de Ayuda** | Reportar un ticket rápido. |

Reglas:

- **RN-ID-55.** Los permisos son capacidades independientes. Tener uno no implica tener otro, salvo el caso especial del rol Administrador.
- **RN-ID-56.** Ver historial de registros no implica poder editar ni anular.
- **RN-ID-57.** Ver la Mesa de Ayuda no implica poder reportar tickets.
- **RN-ID-58.** Gestionar usuarios no implica gestionar roles, y gestionar roles no implica gestionar usuarios.
- **RN-ID-59.** No existen permisos negativos ni excepciones por persona.
- **RN-ID-60.** La falta de sesión impide cualquier acción; la falta de permiso impide la acción concreta.

### 8.7 Matriz de roles iniciales

| Capacidad | Administrador | Editor | Consulta |
| --- | :---: | :---: | :---: |
| Ver registros | Sí | Sí | Sí |
| Crear registros | Sí | Sí | No |
| Editar registros | Sí | Sí | No |
| Anular registros | Sí | No | No |
| Ver historial de registros / anulados | Sí | No | No |
| Gestionar Personal QA | Sí | No | No |
| Gestionar usuarios | Sí | No | No |
| Gestionar roles | Sí | No | No |
| Ver Mesa de Ayuda | Sí | Sí | Sí |
| Crear tickets de Mesa de Ayuda | Sí | Sí | No |

Notas:

- **RN-ID-61.** El Editor puede consultar y reportar tickets de Mesa de Ayuda, pero no puede anular registros ni ver su historial.
- **RN-ID-62.** El Consulta solo puede ver registros y tickets; no puede crear, editar ni anular nada.
- **RN-ID-63.** Los roles personalizados pueden combinar cualquier subconjunto de las diez capacidades.
- **RN-ID-64.** El Administrador no depende de una lista guardada: siempre tiene todas las capacidades, incluidas las que se añadan en el futuro.

### 8.8 Vigencia de permisos

- **RN-ID-65.** Los permisos se resuelven con el rol vigente en cada acción.
- **RN-ID-66.** Revocar una capacidad impide la siguiente acción de ese tipo, aunque la sesión siga abierta.
- **RN-ID-67.** No es necesario volver a iniciar sesión para que una revocación surta efecto.
- **RN-ID-68.** Conceder una capacidad habilita la siguiente acción sin reiniciar sesión.
- **RN-ID-69.** Cambiar a una cuenta de rol no invalida su sesión; cambian sus capacidades.

### 8.9 Puesta en marcha y recuperación local

- **RN-ID-70.** La primera cuenta administradora se crea con un asistente local, antes del uso normal del panel.
- **RN-ID-71.** Ese asistente pide nombre de usuario y contraseña con las mismas reglas del sistema, y crea la información inicial: los 21 QAs, los 10 niveles de la escala, los 3 roles y sus permisos.
- **RN-ID-72.** El asistente solo funciona si **no existe ningún administrador activo**. Si ya existe, falla y no crea nada.
- **RN-ID-73.** Para una segunda cuenta administradora se crea una cuenta normal y se le asigna el rol Administrador desde la pantalla Usuarios.
- **RN-ID-74.** El reinicio local de contraseña de una cuenta administradora:
  - solo acepta cuentas con rol Administrador protegido;
  - pide confirmación explícita;
  - pide la nueva contraseña dos veces;
  - invalida todas las sesiones de esa cuenta;
  - queda registrado en el historial.
- **RN-ID-75.** No existe restablecimiento de contraseña por la pantalla de inicio de sesión ni por ningún formulario público.
- **RN-ID-76.** Las operaciones de puesta en marcha y recuperación local se registran con una etiqueta que identifica el canal local, no con una cuenta de usuario.

### 8.10 Historial de cuentas y roles

El historial de una cuenta registra:

- creación;
- cambios de nombre de usuario, rol o estado;
- restablecimientos de contraseña;
- cambios de contraseña propios.

El historial de un rol registra:

- creación;
- renombrado;
- cambios de permisos, con el conjunto anterior y el nuevo.

Reglas:

- **RN-ID-77.** El historial de cuentas y roles es de solo lectura.
- **RN-ID-78.** No muestra contraseñas, credenciales ni información de sesión.
- **RN-ID-79.** La consulta del historial de cuentas exige permiso de gestión de usuarios.
- **RN-ID-80.** La consulta del historial de roles exige permiso de gestión de roles.
- **RN-ID-81.** Los eventos conservan el nombre de usuario del actor tal como era en ese momento.

### 8.11 Seguridad y privacidad

- **RN-ID-82.** Las acciones que modifican datos solo se aceptan desde la propia aplicación local. Se rechazan intentos provenientes de otros orígenes o de direcciones que no sean el propio equipo.
- **RN-ID-83.** Ninguna respuesta del sistema muestra contraseñas ni información equivalente.
- **RN-ID-84.** Los eventos de historial no contienen contraseñas ni secretos.
- **RN-ID-85.** El producto no se expone a la red local ni a Internet.
- **RN-ID-86.** Los respaldos y la protección del archivo de datos son responsabilidad externa; la aplicación no los gestiona.
- **RN-ID-87.** Cambiar información directamente fuera de la aplicación no pasa por el historial y queda fuera de la trazabilidad del producto.

---

## 9. Mesa de Ayuda

### 9.1 Propósito y modelo mental

La Mesa de Ayuda es el sistema institucional donde se registran los requerimientos técnicos. QABase no reemplaza ese sistema: le agrega dos comodidades al equipo de QA:

1. **Consulta local:** mantiene una copia de los tickets del solicitante institucional, con sus anexos, para consultarlos desde el panel.
2. **Reporte rápido:** permite crear un ticket en la Mesa de Ayuda sin salir del panel, con datos predeterminados.

La **fuente de verdad** de los tickets, sus estados y sus anexos es la Mesa de Ayuda institucional. La copia local es un espejo de consulta.

Notas de funcionamiento:

- La consulta de la copia local y la descarga de anexos ya guardados funcionan sin conexión. **Sincronizar y reportar** requieren comunicación con la Mesa de Ayuda.
- En una instalación de demostración sin conexión configurada, el módulo puede funcionar con una **Mesa de Ayuda simulada** y tickets de ejemplo. Esos tickets no son reales y no deben confundirse con la operación institucional.

### 9.2 Los dos flujos

**Flujo A — Sincronizar y consultar**

- Se sincronizan los tickets del solicitante institucional predeterminado.
- Se guardan o actualizan localmente.
- Se descargan sus anexos.
- Se consultan en el listado y en el detalle.

**Flujo B — Reportar un ticket rápido**

- La persona autorizada completa asunto, descripción y, opcionalmente, anexos.
- QABase crea el ticket en la Mesa de Ayuda institucional.
- La Mesa de Ayuda asigna una referencia.
- QABase guarda una copia local del ticket creado.

### 9.3 Sincronización

- **RN-MA-01.** La sincronización se ejecuta al abrir el módulo y también puede lanzarse manualmente con el botón “Sincronizar”.
- **RN-MA-02.** La sincronización consulta únicamente los tickets cuyo **solicitante** coincide con el solicitante institucional predeterminado: **Jesus Arratia**.
- **RN-MA-03.** La coincidencia del solicitante es por nombre, no por un identificador único. Si existen homónimos o variantes del nombre, la selección puede ser ambigua.
- **RN-MA-04.** Los tickets de otros solicitantes no se sincronizan y no aparecen en la copia local.
- **RN-MA-05.** Para cada ticket remoto, se crea una copia local si no existe o se actualiza si ya existe.
- **RN-MA-06.** La identificación de un ticket para no duplicarlo es su **referencia** de Mesa de Ayuda. La misma referencia siempre corresponde al mismo ticket local.
- **RN-MA-07.** La actualización refresca título, descripción, estado, solicitante, organización, equipo, analista, fecha de reporte y fecha de última sincronización.
- **RN-MA-08.** La fecha de primera creación local se conserva; no se reemplaza en cada sincronización.
- **RN-MA-09.** La sincronización **no elimina** tickets locales que ya no aparezcan en la Mesa de Ayuda. La copia local es acumulativa.
- **RN-MA-10.** La sincronización descarga los anexos de cada ticket y los conserva localmente.
- **RN-MA-11.** Un anexo no se duplica: se identifica por ticket y por su identificador de origen. Si ya existe, se actualizan sus datos.
- **RN-MA-83.** La sincronización no elimina anexos locales que ya no estén en la Mesa de Ayuda; la copia local es acumulativa también en los anexos.
- **RN-MA-12.** Si el archivo local de un anexo se perdió, una nueva sincronización lo vuelve a descargar.
- **RN-MA-13.** La sincronización informa cuántos tickets procesó y cuántos anexos descargó.
- **RN-MA-14.** Si la sincronización falla, se muestra un aviso y se conserva la copia local anterior. No se borra nada.
- **RN-MA-15.** Una sincronización puede quedar parcial si falla a mitad: los tickets ya procesados quedan guardados y los siguientes no. Una nueva sincronización completa lo pendiente.
- **RN-MA-16.** La sincronización exige permiso para ver la Mesa de Ayuda. Según la implementación actual, **no exige** el permiso de creación de tickets. Es una inconsistencia con la descripción interna del permiso, que asocia crear y sincronizar; debe decidirse si se mantiene o se corrige.
- **RN-MA-17.** La sincronización no deja un evento visible en el historial de tickets. Solo el reporte rápido genera un evento de alta.

### 9.4 Reporte rápido de ticket

- **RN-MA-18.** El reporte rápido está disponible solo para cuentas con permiso de creación de tickets.
- **RN-MA-19.** Los campos que completa la persona usuaria son:
  - **Asunto**, obligatorio, de 1 a 200 caracteres después de recortar.
  - **Descripción detallada**, obligatoria, de 1 a 5000 caracteres después de recortar.
  - **Anexos**, opcionales y múltiples.
- **RN-MA-20.** El formulario no permite editar organización, solicitante, origen, equipo ni analista. Esos valores son fijos.
- **RN-MA-21.** El asunto y la descripción se recortan antes de validar y se envían sin espacios sobrantes.
- **RN-MA-22.** Un asunto o una descripción vacíos, o formados solo por espacios, se rechazan.
- **RN-MA-23.** Un asunto de más de 200 caracteres o una descripción de más de 5000 se rechazan.
- **RN-MA-24.** Los anexos son opcionales; se pueden enviar uno o varios.
- **RN-MA-25.** No hay una regla de negocio declarada sobre tipos de archivo, tamaño máximo o cantidad máxima de anexos. Si se necesita, es una decisión pendiente.
- **RN-MA-26.** El ticket se crea primero en la Mesa de Ayuda institucional. Solo si la Mesa de Ayuda lo acepta se guarda la copia local.
- **RN-MA-27.** Si la Mesa de Ayuda rechaza o no puede procesar el ticket, no se crea una copia local y se informa del error.
- **RN-MA-28.** La referencia del ticket la asigna la Mesa de Ayuda, no QABase.
- **RN-MA-29.** La copia local del ticket creado nace con estado **Nuevo**.
- **RN-MA-30.** El ticket se registra en la Mesa de Ayuda con origen **portal** y con un comentario que indica que fue creado desde el panel.
- **RN-MA-31.** El alta local deja un evento de historial con la persona que reportó, la referencia y el asunto.
- **RN-MA-32.** La persona que reporta desde el panel puede no ser el solicitante institucional. La Mesa de Ayuda verá como solicitante a **Jesus Arratia**, mientras que el historial local registra a la cuenta que hizo el reporte. Esa separación es intencional en la implementación actual, pero debe validarse como política.

### 9.5 Valores predeterminados del ticket

| Dato | Valor fijo | Se muestra en el formulario |
| --- | --- | --- |
| Organización | `HelpDesk_TI` | Sí, como aviso de valores predeterminados. |
| Solicitante / reportado por | `Jesus Arratia` | Sí. |
| Origen | `portal` | Sí, como aviso; no editable. |
| Equipo asignado | `Tecnologias` | Sí, como “Tecnologías - JORGE PACOMPIA”. |
| Analista asignado | `JORGE PACOMPIA` | Sí. |

Reglas:

- **RN-MA-33.** Los cinco valores son parte de la configuración de negocio de esta versión y no se editan desde la pantalla.
- **RN-MA-34.** El nombre del solicitante predeterminado se parece al de una persona del catálogo de QA, pero **no existe vínculo automático** entre ambos.
- **RN-MA-35.** El equipo y el analista se resuelven por nombre en la Mesa de Ayuda. Si hay homónimos, la asignación puede ser ambigua.
- **RN-MA-36.** Si en el futuro se necesita reportar a nombre de otra persona, otro equipo u otro analista, se requiere una decisión de producto y un cambio de alcance.

### 9.6 Datos de un ticket

Cada ticket local conserva:

| Dato | Descripción |
| --- | --- |
| **Referencia** | Identificador visible de la Mesa de Ayuda, con forma `R-` seguida de números. |
| **Asunto** | Título breve del requerimiento. |
| **Descripción** | Detalle del problema o solicitud; puede faltar en tickets sincronizados. |
| **Estado** | Estado informado por la Mesa de Ayuda. |
| **Solicitante** | Persona que reportó el ticket en la Mesa de Ayuda. |
| **Organización** | Organización del solicitante. |
| **Equipo asignado** | Equipo que atiende el ticket; puede faltar. |
| **Analista asignado** | Persona que atiende el ticket; puede faltar. |
| **Fecha de reporte** | Fecha informada por la Mesa de Ayuda. En tickets creados desde el panel, es el momento de creación local. |
| **Fecha de creación local** | Primera vez que el ticket se guardó en QABase. |
| **Última sincronización** | Última vez que se actualizó la copia local. |
| **Anexos** | Archivos asociados, con nombre, tipo, tamaño y fecha de sincronización. |

### 9.7 Estados del ticket

El listado traduce los estados conocidos:

| Estado de origen | Etiqueta visible |
| --- | --- |
| `new` | Nuevo |
| `assigned` | Asignado |
| `resolved` | Resuelto |
| `closed` | Cerrado |

Reglas:

- **RN-MA-37.** Los estados conocidos se muestran en español.
- **RN-MA-38.** Un estado desconocido se muestra tal como llega, sin inventar una traducción.
- **RN-MA-39.** El estado lo controla la Mesa de Ayuda. QABase no permite cambiarlo desde el panel.
- **RN-MA-40.** La sincronización actualiza el estado local con el estado remoto.
- **RN-MA-41.** Un ticket creado desde el panel queda como “Nuevo” hasta que una sincronización posterior traiga otro estado.

### 9.8 Anexos

- **RN-MA-42.** Un ticket puede tener cero, uno o varios anexos.
- **RN-MA-43.** Los anexos se descargan durante la sincronización y se conservan localmente.
- **RN-MA-44.** El detalle del ticket muestra el número de anexos, el nombre, el tamaño legible y una acción para descargar cada uno.
- **RN-MA-45.** La descarga exige permiso para ver la Mesa de Ayuda.
- **RN-MA-46.** Si el archivo local no existe, la descarga informa que no está disponible; una nueva sincronización puede recuperarlo.
- **RN-MA-47.** No hay vista previa de anexos dentro del panel; solo descarga.
- **RN-MA-48.** Al reportar un ticket, los anexos elegidos se envían a la Mesa de Ayuda y se guardan también en la copia local.
- **RN-MA-49.** No se pueden añadir anexos a un ticket existente desde QABase.

### 9.9 Listado, búsqueda y detalle

**Listado**

Muestra:

- referencia;
- asunto y un extracto de la descripción;
- estado;
- analista asignado;
- fecha de reporte;
- acción “Ver detalle”.

Reglas:

- **RN-MA-50.** El listado se ordena por fecha de reporte descendente; ante empate, por identificador local descendente.
- **RN-MA-51.** No hay paginación: se muestra el conjunto filtrado completo.
- **RN-MA-52.** No hay filtros por estado, fecha, equipo u organización.
- **RN-MA-53.** La búsqueda es local, sobre la copia ya cargada, y se aplica a:
  - referencia;
  - asunto;
  - analista asignado.
- **RN-MA-54.** La búsqueda es por coincidencia parcial y sin distinguir mayúsculas de minúsculas.
- **RN-MA-55.** La búsqueda **no** cubre descripción, solicitante, organización ni equipo.
- **RN-MA-56.** Se muestra el total de tickets que coinciden con la búsqueda.
- **RN-MA-57.** Si no hay coincidencias, se informa que no se encontraron tickets.

**Detalle**

Muestra:

- referencia y asunto;
- estado;
- fecha de reporte;
- organización;
- solicitante;
- equipo asignado;
- analista asignado;
- descripción completa;
- anexos y descarga.

Reglas:

- **RN-MA-58.** El detalle es de solo lectura.
- **RN-MA-59.** Si falta la descripción, se indica “Sin descripción”.
- **RN-MA-60.** Si falta el equipo, se muestra “Tecnologias” como valor de presentación.
- **RN-MA-61.** Si falta el analista, el listado muestra “Tecnologías” y el detalle muestra “JORGE PACOMPIA”. Es una inconsistencia de presentación que conviene unificar; no cambia la regla de negocio: el dato puede faltar.
- **RN-MA-62.** El detalle no permite editar, anular, cerrar, reasignar ni comentar el ticket.
- **RN-MA-82.** En el detalle, el estado se muestra con el valor original de la Mesa de Ayuda; en el listado se muestra traducido cuando es conocido. Unificar esa presentación es una decisión pendiente.

### 9.10 Permisos de Mesa de Ayuda

- **RN-MA-63.** Ver el módulo, listar tickets, abrir el detalle, descargar anexos y sincronizar exigen permiso para ver la Mesa de Ayuda.
- **RN-MA-64.** Reportar un ticket exige permiso para crear tickets.
- **RN-MA-65.** Una cuenta sin permiso para ver la Mesa de Ayuda no puede acceder al módulo, aunque tenga permiso para crear tickets.
- **RN-MA-66.** Una cuenta con permiso para ver pero sin permiso para crear puede consultar y sincronizar, pero no ve el botón de reporte y no puede crear tickets.
- **RN-MA-67.** El rol Editor inicial puede ver, sincronizar y reportar.
- **RN-MA-68.** El rol Consulta inicial puede ver y sincronizar, pero no reportar.

### 9.11 Errores y situaciones límite

- **RN-MA-69.** Si la Mesa de Ayuda no responde al sincronizar, se muestra un aviso y se conserva la copia local.
- **RN-MA-70.** Si la Mesa de Ayuda no responde al reportar, no se crea ticket local y se informa del fallo.
- **RN-MA-71.** No hay cola de reintento ni borrador persistente para tickets no enviados.
- **RN-MA-72.** Si el ticket se crea en la Mesa de Ayuda pero falla el guardado local, el ticket existirá en la Mesa de Ayuda y podrá aparecer en una sincronización posterior, siempre que su solicitante coincida con el predeterminado.
- **RN-MA-73.** Si un ticket remoto cambia de referencia, se trataría como un ticket distinto; la referencia es la clave de conciliación.
- **RN-MA-74.** Si un ticket desaparece de la Mesa de Ayuda, la copia local permanece.
- **RN-MA-75.** No se puede reportar un ticket sin asunto o sin descripción.
- **RN-MA-76.** No se puede reportar un ticket con asunto o descripción que superen los máximos.
- **RN-MA-77.** Un ticket sincronizado puede no tener descripción, equipo o analista; el sistema debe mostrarlo sin fallar.

### 9.12 Lo que la Mesa de Ayuda no hace

- No crea, modifica ni cierra tickets en la Mesa de Ayuda salvo el alta rápida.
- No cambia el estado local de forma manual.
- No asigna ni reasigna analistas.
- No añade comentarios.
- No elimina tickets.
- No adjunta archivos a tickets existentes.
- No notifica cambios.
- No relaciona tickets con QAs, méritos o incidencias.
- No calcula SLA, tiempos de atención ni métricas de soporte.
- No sincroniza tickets de otros solicitantes.
- No funciona como sistema de tickets independiente.

### 9.13 Trazabilidad de Mesa de Ayuda

- **RN-MA-78.** El alta rápida deja un evento de historial local con la cuenta que reportó, la referencia y el asunto.
- **RN-MA-79.** La sincronización no deja un evento de historial visible.
- **RN-MA-80.** No hay una pantalla de historial de tickets en el panel.
- **RN-MA-81.** La trazabilidad completa del ciclo del ticket vive en la Mesa de Ayuda institucional, no en QABase.

---

## 10. Flujos de negocio paso a paso

### 10.1 Registrar un mérito o una incidencia

1. La persona entra a **Méritos e Incidencias**.
2. El sistema muestra los totales del mes actual y el listado filtrado.
3. La persona pulsa **Nuevo registro** si tiene permiso para crear.
4. Selecciona un QA activo.
5. Selecciona el tipo: mérito o incidencia.
6. Confirma o cambia la fecha del hecho; por defecto es hoy y no puede ser futura.
7. Selecciona un nivel de 1 a 5.
8. Escribe el detalle.
9. Guarda.
10. El sistema valida, crea el registro vigente, registra el evento de historial y refresca listado y totales.

**Resultado:** el registro aparece en el listado, cuenta en los totales y queda disponible para edición o anulación según permisos.

### 10.2 Corregir un registro

1. La persona busca el registro.
2. Pulsa **Editar** si tiene permiso y el registro está vigente.
3. Modifica uno o varios campos.
4. Guarda con la versión vigente.
5. El sistema valida; si el QA cambió, exige que el destino esté activo.
6. El sistema actualiza el registro y guarda el antes y el después en el historial.
7. Listado y totales se refrescan.

**Resultado:** el registro conserva su identificador y su historia; solo cambian los datos de negocio y la versión.

### 10.3 Anular un registro

1. La persona busca un registro vigente.
2. Pulsa **Anular** si tiene permiso.
3. El sistema muestra el QA, el tipo y la fecha del hecho, y advierte que la anulación es irreversible.
4. La persona escribe el motivo.
5. Confirma explícitamente.
6. El sistema valida motivo, versión y estado.
7. El registro pasa a anulado, deja de contar y se registra el evento.
8. Listado y totales se refrescan.

**Resultado:** el registro sigue existiendo, no se edita, no se restaura y no cuenta en los totales.

### 10.4 Consultar el mes y filtrar

1. La persona entra al módulo.
2. El sistema aplica por defecto el mes local actual.
3. La persona puede cambiar a mes anterior, rango personalizado o todo el historial.
4. Puede combinar QA, tipo, nivel y texto.
5. El listado se ordena por fecha del hecho descendente.
6. Los totales y la tabla por QA se recalculan con los mismos filtros.
7. La paginación permite 25, 50 o 100 registros por página.

**Resultado:** la persona ve los registros y totales coherentes con los filtros aplicados.

### 10.5 Dar de alta a una persona del Personal QA

1. Un administrador entra a **Personal QA**.
2. Escribe el nombre completo.
3. Confirma el alta.
4. El sistema valida el nombre, crea la persona activa con identificador estable y registra el evento.
5. La persona queda disponible para nuevos registros.

**Resultado:** existe una nueva persona en el catálogo, sin cuenta de usuario asociada.

### 10.6 Desactivar a una persona del Personal QA

1. Un administrador busca a la persona.
2. Pulsa **Desactivar** y confirma.
3. El sistema cambia el estado y registra el evento.
4. La persona deja de aparecer por defecto en el listado y deja de estar disponible para nuevos registros.
5. Sus registros históricos siguen visibles y siguen mostrando su nombre con la etiqueta de inactiva.

**Resultado:** la persona no se borra y su historia se conserva.

### 10.7 Crear una cuenta de acceso

1. Un administrador entra a **Usuarios**.
2. Escribe nombre de usuario, contraseña inicial y selecciona un rol.
3. Confirma.
4. El sistema valida reglas, unicidad y rol; crea la cuenta activa y registra el evento.

**Resultado:** la persona puede iniciar sesión con el rol asignado. No se crea ni modifica ningún QA.

### 10.8 Cambiar el rol o los permisos

1. Un administrador entra a **Usuarios** o **Roles**.
2. Cambia el rol de una cuenta o edita el conjunto de permisos de un rol.
3. El sistema valida que no se rompa la protección del último administrador ni del rol Administrador.
4. Guarda el cambio y registra el antes y el después.
5. Las cuentas afectadas ven el cambio en su siguiente acción, sin reiniciar sesión.

**Resultado:** las capacidades vigentes cambian de inmediato para las siguientes operaciones.

### 10.9 Restablecer una contraseña

**Desde la pantalla Usuarios:**

1. Un administrador elige la cuenta.
2. Escribe la nueva contraseña.
3. Confirma.
4. El sistema valida, actualiza la contraseña, cierra todas las sesiones de la cuenta y registra el evento.

**Desde la recuperación local:**

1. El operador ejecuta el asistente local.
2. Indica una cuenta con rol Administrador protegido.
3. Confirma la operación.
4. Escribe dos veces la nueva contraseña.
5. El sistema actualiza, cierra sesiones y registra el evento.

**Resultado:** la contraseña anterior deja de funcionar y las sesiones abiertas quedan invalidadas.

### 10.10 Reportar un ticket rápido

1. La persona entra a **Mesa de Ayuda**.
2. Pulsa **Reportar Ticket** si tiene permiso para crear.
3. Lee los valores predeterminados de organización, solicitante, origen, equipo y analista.
4. Escribe asunto y descripción.
5. Añade anexos si lo necesita.
6. Envía.
7. El sistema valida y crea el ticket en la Mesa de Ayuda institucional.
8. Si la Mesa de Ayuda acepta, guarda la copia local, registra el evento y vuelve al listado.
9. Si la Mesa de Ayuda rechaza, muestra el error y no crea copia local.

**Resultado:** el ticket existe en la Mesa de Ayuda con una referencia y, si fue aceptado, en la copia local del panel.

### 10.11 Sincronizar tickets

1. La persona entra a **Mesa de Ayuda**; el sistema intenta sincronizar automáticamente.
2. También puede pulsar **Sincronizar**.
3. El sistema consulta los tickets del solicitante predeterminado.
4. Crea o actualiza las copias locales.
5. Descarga los anexos que falten.
6. Refresca el listado.
7. Si algo falla, muestra un aviso y conserva la copia anterior.

**Resultado:** la copia local refleja los tickets y anexos disponibles del solicitante, sin borrar los que ya no aparezcan.

---

## 11. Casos de aceptación de negocio

| # | Situación | Resultado exigido |
| --- | --- | --- |
| 1 | Registrar un mérito con QA activo, fecha de hoy, nivel 3 y detalle válido. | Queda vigente, cuenta como 1 mérito y 3 puntos de mérito. |
| 2 | Registrar una incidencia con fecha pasada, nivel 2 y detalle válido. | Queda vigente, cuenta como 1 incidencia y 2 puntos de incidencia. |
| 3 | Intentar registrar con fecha futura. | Se rechaza; no se crea nada. |
| 4 | Intentar registrar con un QA inactivo. | Se rechaza; no se crea nada. |
| 5 | Intentar registrar con detalle vacío o solo espacios. | Se rechaza; no se crea nada. |
| 6 | Intentar registrar con nivel 0, 6 o texto. | Se rechaza; no se crea nada. |
| 7 | Editar un registro vigente y cambiar QA, tipo, fecha, detalle y nivel con la versión actual. | Se guardan los nuevos valores y el historial conserva el antes y el después. |
| 8 | Editar con una versión anterior a la vigente. | Se rechaza; el registro conserva los datos de la versión vigente. |
| 9 | Cambiar el QA de un registro a uno inactivo. | Se rechaza; el registro conserva su QA original. |
| 10 | Editar solo el detalle de un registro cuyo QA está inactivo. | Se acepta; el QA inactivo se conserva. |
| 11 | Intentar editar un registro anulado. | Se rechaza; el registro sigue anulado e inmutable. |
| 12 | Anular un registro vigente con motivo y confirmación. | Queda anulado, conserva el motivo y deja de contar en totales. |
| 13 | Cancelar la confirmación de anulación. | El registro sigue vigente; no se crea evento. |
| 14 | Intentar anular un registro ya anulado. | Se rechaza; no se duplica el evento. |
| 15 | Consultar sin rango personalizado. | Se aplica el mes local actual. |
| 16 | Filtrar por QA inactivo, tipo incidencia, nivel 2 y texto. | Solo aparecen los registros que cumplen todos los criterios. |
| 17 | Consultar 26 registros con página de 25. | El listado muestra 25; los totales informan 26. |
| 18 | Consultar 2 méritos de niveles 3 y 5 y 1 incidencia de nivel 2. | Se informan 2 méritos/8 puntos y 1 incidencia/2 puntos; no hay saldo neto. |
| 19 | Incluir un mérito anulado en el listado. | Aparece en el listado, pero no en las tarjetas ni en la tabla por QA. |
| 20 | Consultar la tabla por QA con una persona sin registros. | La persona aparece con ceros, en orden alfabético. |
| 21 | Renombrar un QA con registros. | Conserva el identificador; los registros muestran el nombre nuevo; el historial conserva el cambio. |
| 22 | Crear dos QAs con el mismo nombre. | Se crean dos personas distintas con identificadores distintos. |
| 23 | Desactivar y reactivar un QA. | El mismo identificador conserva registros e historial. |
| 24 | Desactivar un QA y abrir el formulario de nuevo registro. | El QA no está disponible para selección; sigue visible en registros históricos. |
| 25 | Añadir un QA. | No se crea cuenta ni se asigna rol. |
| 26 | Intentar desactivar al único administrador activo. | Se rechaza; la cuenta sigue activa con rol Administrador. |
| 27 | Intentar renombrar el rol Administrador o editar sus permisos. | Se rechaza; el rol conserva nombre y capacidades. |
| 28 | Revocar el permiso de creación de un rol mientras una cuenta tiene sesión. | La siguiente creación se rechaza; la sesión sigue abierta. |
| 29 | Desactivar una cuenta con sesión abierta. | La siguiente acción de esa sesión se rechaza. |
| 30 | Restablecer la contraseña de una cuenta con dos sesiones. | Ambas sesiones dejan de ser válidas. |
| 31 | Intentar iniciar sesión seis veces con contraseña incorrecta en quince minutos. | El sexto intento se rechaza por demasiados intentos. |
| 32 | Iniciar sesión con usuario inexistente o contraseña incorrecta. | Mismo mensaje genérico; no se revela si la cuenta existe. |
| 33 | Crear una cuenta con un nombre ya usado con otras mayúsculas. | Se rechaza por nombre duplicado. |
| 34 | Reportar un ticket con asunto y descripción válidos. | Se crea en la Mesa de Ayuda, recibe referencia y se guarda copia local con los valores predeterminados. |
| 35 | Reportar un ticket sin asunto o sin descripción. | Se rechaza; no se crea nada. |
| 36 | Intentar reportar un ticket con una cuenta que solo puede ver. | Se rechaza por falta de permiso. |
| 37 | Sincronizar dos veces los mismos tickets. | No se duplican; se actualizan las copias existentes. |
| 38 | Sincronizar con la Mesa de Ayuda caída. | Se muestra aviso y se conserva la copia local anterior. |
| 39 | Buscar un ticket por referencia, asunto o analista. | Se filtra la lista local por coincidencia parcial. |
| 40 | Descargar un anexo sin permiso para ver la Mesa de Ayuda. | Se rechaza. |

---

## 12. Decisiones pendientes y riesgos de negocio

Estos puntos no son fallos de funcionamiento, sino decisiones que conviene cerrar antes de ampliar el producto:

1. **Alcance de la sincronización.** Hoy solo se sincronizan tickets de “Jesus Arratia”. ¿Debe el equipo ver únicamente los tickets de ese solicitante o los de todo el equipo?
2. **Solicitante fijo.** Todos los tickets rápidos se reportan a nombre de “Jesus Arratia”, aunque los cree otra persona. ¿Es una regla permanente o una configuración temporal?
3. **Equipo y analista fijos.** Todos los tickets se asignan a “Tecnologias / JORGE PACOMPIA”. ¿Debe permitirse elegir equipo o analista?
4. **Permiso de sincronización.** La descripción del permiso asocia crear y sincronizar, pero la implementación permite sincronizar solo con permiso de ver. Decidir la política.
5. **Límites de anexos.** No hay regla de tipo, tamaño o cantidad. Definir si se necesita.
6. **Estados de ticket.** El listado traduce los estados, pero el detalle muestra el valor original. Unificar la presentación.
7. **Historial de sincronización.** La sincronización no deja evento. Si la trazabilidad de actualizaciones importa, debe registrarse.
8. **Filtros de Mesa de Ayuda.** No hay filtros por estado, fecha, equipo ni paginación. Evaluar si el volumen esperado lo requiere.
9. **Reporte sin conexión.** No hay cola de tickets pendientes. Si la Mesa de Ayuda no está disponible, no se puede reportar.
10. **Búsqueda sin tildes.** La búsqueda conserva tildes y Ñ. Si se espera que “munoz” encuentre “Muñoz”, hay que cambiar la regla.
11. **Duplicados de nombre de rol.** La unicidad distingue mayúsculas de minúsculas. Si se quiere evitar “Administrador” y “administrador”, hay que endurecer la regla.
12. **Respaldo y continuidad.** Siguen fuera de alcance. Conviene que el equipo sepa que la pérdida del archivo local implica pérdida de la copia de tickets y de los anexos.
13. **Vínculo QA–cuenta.** No existe. Si se necesita que una cuenta represente a una persona del catálogo, es un cambio de alcance.
14. **Edición concurrente de permisos de rol.** La última selección guardada reemplaza a la anterior y no hay control de versión en esa operación. Si se quiere detectar conflictos, debe añadirse.

---

## 13. Resumen operativo para entregar a otro modelo

QABase es un panel local para el equipo de QA con cinco dominios funcionales:

1. **Personal QA:** catálogo de personas con identificador estable, nombre, estado activo/inactivo, versión e historial. Se puede crear, renombrar, desactivar y reactivar; nunca borrar. Los homónimos están permitidos. Añadir un QA no crea una cuenta. Un QA inactivo no se ofrece para nuevos registros, pero permanece en la historia, los filtros y los resúmenes.

2. **Méritos e incidencias:** cada registro pertenece a un QA y tiene tipo (mérito o incidencia), fecha del hecho, nivel de 1 a 5, detalle de 1 a 5000 caracteres y estado (vigente o anulado). La fecha no puede ser futura y no tiene límite inferior. Un registro vigente se edita con su versión; si el QA cambia, el destino debe estar activo; si se conserva un QA inactivo, se pueden corregir los demás campos. La anulación exige motivo de 1 a 1000 caracteres, confirmación explícita y versión; es irreversible, no se restaura y excluye el registro de todos los totales.

3. **Consultas y métricas:** por defecto se consulta el mes local actual. Se puede usar mes anterior, rango personalizado, rango abierto o todo el historial. Los filtros por QA, tipo, nivel y texto se combinan. El listado se ordena por fecha del hecho descendente, luego por creación descendente y luego por identificador descendente. Se pagina de 25, 50 o 100. Los totales se calculan sobre todos los resultados vigentes filtrados, no sobre la página. Se informan por separado cantidad y puntos de méritos y cantidad y puntos de incidencias. No hay saldo neto ni ranking. La tabla por QA incluye todo el catálogo, incluso inactivos y personas sin resultados.

4. **Identidad y permisos:** no hay registro público. Cada cuenta tiene un rol y un estado. El rol Administrador es protegido, no se renombra ni se editan sus permisos, y siempre tiene todas las capacidades. El último administrador activo no se desactiva ni cambia de rol; nadie se autodesactiva. Las cuentas se desactivan, no se borran. Las contraseñas tienen 12 a 128 caracteres y nunca se muestran. Los usuarios se bloquean tras cinco fallos en quince minutos. Las sesiones duran como máximo ocho horas. Desactivar una cuenta o restablecer su contraseña invalida sus sesiones. Los permisos se aplican en cada acción: una revocación surte efecto en la siguiente operación.

5. **Mesa de Ayuda:** mantiene una copia local de los tickets del solicitante institucional “Jesus Arratia” y permite reportar tickets rápidos. Los tickets se concilian por referencia; sincronizar crea o actualiza, nunca borra. Los anexos se descargan y se conservan. El reporte rápido solo pide asunto (1 a 200), descripción (1 a 5000) y anexos opcionales; organización, solicitante, origen, equipo y analista son fijos. El ticket se crea primero en la Mesa de Ayuda y solo después se guarda localmente. Los estados se actualizan por sincronización. No se editan, cierran, reasignan ni comentan tickets desde el panel.

Los invariantes que nunca deben romperse:

- No hay borrado físico.
- No hay restauración de anulados.
- No hay saldo neto ni rankings.
- No hay vínculo automático entre QA y cuenta.
- No hay permisos por persona fuera del rol.
- No hay cambios sin historial.
- No hay escrituras con versión vieja.
- No hay acceso remoto por red.
- No se muestran contraseñas ni secretos.
- La Mesa de Ayuda institucional es la fuente de verdad de los tickets; QABase es su copia local y su puerta de reporte.

## 14. Decisiones de arquitectura, datos y backend

> Esta sección es técnica y complementa las anteriores. Su objetivo es fijar las decisiones estructurales que permiten que QABase tenga varios módulos y que puedan añadirse módulos nuevos sin rehacer el núcleo.
>
> Quedan fuera de esta sección las decisiones de diseño visual, experiencia de usuario, componentes gráficos, colores, tipografía, disposición de pantallas y metodología de desarrollo.

### 14.1 Objetivo arquitectónico

QABase debe crecer como un producto modular, no como una aplicación rígida de un solo propósito. La arquitectura se elige para que:

- el núcleo transversal permanezca estable;
- cada módulo de negocio pueda evolucionar con autonomía;
- añadir un módulo no obligue a modificar la lógica de los módulos existentes;
- los permisos, la auditoría, la sesión, la validación y el manejo de errores se compartan;
- los datos sigan siendo locales, consistentes y auditables;
- el producto siga siendo una sola instalación y no una red de servicios.

Decisiones:

- **ARQ-01.** El producto es un **monolito modular**: una sola aplicación desplegable, un solo proceso de servidor y una sola base de datos local.
- **ARQ-02.** El servidor sirve tanto la interfaz compilada como las operaciones de negocio. No hay un servicio separado para la interfaz.
- **ARQ-03.** El núcleo concentra lo transversal: datos, autenticación, permisos, auditoría, errores y normalización de texto.
- **ARQ-04.** Cada módulo de negocio es una **rebanada vertical** con sus rutas, servicio, repositorio, datos y, cuando corresponde, su pantalla.
- **ARQ-05.** Los módulos no se llaman entre sí a nivel de servicio. Lo compartido se promueve al núcleo o se expresa mediante contratos.
- **ARQ-06.** Un módulo puede leer datos de otro mediante consultas explícitas en su repositorio, pero las escrituras las realiza el módulo dueño de esos datos.
- **ARQ-07.** Los contratos compartidos viven en un paquete común de tipos y límites, sin lógica de negocio y sin dependencia de la interfaz.
- **ARQ-08.** Los permisos son parte de la arquitectura del producto, no de cada pantalla. Un módulo nuevo declara sus permisos una sola vez y el resto del sistema los reconoce.
- **ARQ-09.** Las migraciones y los datos iniciales son parte del ciclo de vida del módulo. Un módulo con datos propios debe traer su migración.
- **ARQ-10.** Los módulos se registran **por código y de forma estática**. No hay carga de plugins en caliente, scripts arbitrarios ni módulos instalables sin recompilar y reiniciar.
- **ARQ-11.** La arquitectura no depende de servicios externos. La única integración saliente es la Mesa de Ayuda institucional.
- **ARQ-12.** La arquitectura no es multiempresa ni multiorganización. Una instalación atiende a un solo equipo.
- **ARQ-13.** La arquitectura no es de microservicios, no usa una base por módulo y no requiere contenedores.
- **ARQ-14.** La arquitectura prioriza la simplicidad local y la trazabilidad sobre la escalabilidad horizontal. Es una decisión deliberada para el tamaño y el uso previstos.

### 14.2 Estilo y fronteras

**Capas**

| Capa | Responsabilidad | No debe hacer |
| --- | --- | --- |
| **Núcleo** | Datos, autenticación, sesiones, permisos, auditoría, errores, texto. | Conocer reglas de un módulo de negocio. |
| **Módulo de negocio** | Rutas, servicio, repositorio y reglas de su dominio. | Conocer HTTP en el servicio, React en el servicio o SQL en la interfaz. |
| **Contratos** | Tipos, límites y formas compartidas. | Ejecutar lógica de negocio o acceder a datos. |
| **Interfaz** | Pantallas, clientes de operaciones y navegación. | Ejecutar SQL o decidir la autorización final. |

Decisiones:

- **ARQ-15.** El núcleo no importa módulos de negocio. Los módulos sí pueden importar el núcleo.
- **ARQ-16.** Los módulos no importan servicios de otros módulos. La comunicación se hace por datos compartidos, contratos o funciones del núcleo.
- **ARQ-17.** Los servicios de negocio no conocen HTTP, sesiones ni React. Reciben datos ya validados y el actor identificado.
- **ARQ-18.** Los repositorios de módulo y los componentes de datos del núcleo son los únicos que contienen consultas a la base de datos. Ni las rutas, ni los servicios, ni la interfaz contienen SQL.
- **ARQ-19.** La interfaz no contiene SQL ni accede directamente a la base.
- **ARQ-20.** La autorización definitiva vive en el servidor. La interfaz puede ocultar acciones, pero no concede permisos.
- **ARQ-21.** Las reglas de negocio viven en el servicio y en las restricciones de la base; la ruta solo valida forma y permisos.
- **ARQ-22.** La validación se aplica en profundidad: forma en la ruta, regla en el servicio e invariante en la base.
- **ARQ-23.** Lo transversal que necesiten dos o más módulos se promueve al núcleo; no se copia.
- **ARQ-24.** Lo que compartan servidor e interfaz se expresa como contrato; no se duplica como texto libre.

### 14.3 Permisos y evolución de módulos

Los permisos son claves fijas con formato `modulo.accion`. Se declaran en el registro del servidor y en su espejo de la interfaz.

Decisiones:

- **PERM-01.** El registro canónico de permisos del servidor es la lista de claves conocidas del núcleo de permisos.
- **PERM-02.** La interfaz mantiene una lista espejo de las mismas claves para ocultar navegación y acciones.
- **PERM-03.** El servidor es la autoridad. Una clave presente solo en la interfaz no concede nada.
- **PERM-04.** El rol Administrador protegido recibe de forma implícita **todos** los permisos conocidos, incluidos los de módulos futuros.
- **PERM-05.** Añadir un permiso nuevo no exige migrar las concesiones del rol Administrador.
- **PERM-06.** Un permiso desconocido se rechaza; no se crea por accidente.
- **PERM-07.** Los permisos repetidos en una misma concesión se deduplican.
- **PERM-08.** Un módulo declara permisos separados cuando las capacidades son separables: ver, crear, editar, anular, auditar, gestionar.
- **PERM-09.** No se reutiliza un permiso de otro módulo para una capacidad nueva.
- **PERM-10.** No hay permisos negativos, herencia entre roles ni concesiones por persona.
- **PERM-11.** Una cuenta tiene un solo rol; su conjunto efectivo de permisos es el del rol.
- **PERM-12.** El rol protegido no se renombra ni se le editan concesiones.
- **PERM-13.** Los permisos se resuelven en cada petición, sin caché entre peticiones.
- **PERM-14.** La navegación de un módulo usa un permiso funcional; no existen permisos de menú separados.
- **PERM-15.** Si un módulo necesita varias capacidades, la entrada de navegación usa la capacidad mínima para verlo y las acciones internas usan las demás.

### 14.4 Base de datos: decisiones estructurales

**Motor y modo de trabajo**

- **BD-01.** La base es **SQLite local**, en un único archivo. No hay servidor de base de datos ni base por módulo.
- **BD-02.** Al abrir la base se activan claves foráneas, modo WAL y un tiempo de espera de bloqueo. Esto permite lecturas concurrentes y un escritor ordenado en el uso local previsto.
- **BD-03.** La ruta del archivo es configurable; por defecto vive en `data/qabase.sqlite` dentro del proyecto.
- **BD-04.** La carpeta `data/` no se versiona y no se sirve como contenido estático.
- **BD-05.** El acceso a la base es exclusivamente del backend. La interfaz nunca abre ni consulta el archivo.
- **BD-06.** No se usa ORM. El SQL es explícito y parametrizado; los valores nunca se concatenan.
- **BD-07.** Las consultas de escritura usan la forma `WHERE id = ? AND version = ?` cuando la entidad es editable.
- **BD-08.** La convención es que las lecturas usen listas explícitas de columnas y no dependan de `SELECT *` en el código de negocio. El módulo de Mesa de Ayuda es la excepción actual en sus lecturas internas; si se busca consistencia total, debe alinearse.

**Migraciones**

- **BD-09.** Las migraciones son archivos SQL con prefijo numérico y se aplican en orden antes de aceptar solicitudes.
- **BD-10.** Cada migración aplicada se registra con versión, nombre y fecha en la tabla de control de migraciones.
- **BD-11.** Las migraciones son **solo hacia adelante**. No hay migraciones de reversión automática.
- **BD-12.** Una migración ya aplicada en una base real **no se edita**. Cualquier corrección se hace con una migración nueva.
- **BD-13.** Cada migración se aplica de forma atómica: si falla, no queda a medias ni se registra como aplicada.
- **BD-14.** Si una migración falla, el arranque se aborta. La aplicación no limpia, no recrea ni repara datos por su cuenta.
- **BD-15.** El runner no verifica el contenido de una migración ya aplicada; la regla de no editarla es una convención obligatoria, no una protección automática.
- **BD-16.** El orden se deriva del nombre; un archivo sin prefijo numérico es inválido y aborta la lectura de migraciones.

**Datos iniciales**

- **BD-17.** Los datos iniciales se cargan con operaciones **insert-only**: solo crean filas faltantes y nunca sobrescriben filas existentes.
- **BD-18.** Los textos de catálogos ya existentes no se pisan en cada arranque. Una corrección manual del texto se conserva.
- **BD-19.** Los datos iniciales incluyen el catálogo de Personal QA, la escala de impacto, los roles base, los permisos conocidos y sus concesiones iniciales.
- **BD-20.** Los identificadores de origen del catálogo inicial se conservan; no se renumeran ni se fusionan homónimos.
- **BD-21.** Los datos iniciales se ejecutan tanto en el arranque normal como en los asistentes locales de administración.

**Integridad y restricciones**

- **BD-22.** Las entidades de negocio con identificador propio usan enteros estables. Las tablas de catálogo, concesiones y sesión usan claves naturales o compuestas según su naturaleza.
- **BD-23.** Las referencias de negocio usan claves foráneas con `RESTRICT`: no se puede borrar una fila de la que dependan registros históricos.
- **BD-24.** No existe borrado físico desde la aplicación. Las entidades se desactivan, se anulan o se conservan.
- **BD-25.** La única cascada declarada es la de anexos de Mesa de Ayuda respecto de su ticket. Como no existe operación de borrado de tickets, la cascada no se ejerce desde el producto.
- **BD-26.** Las entidades editables tienen columna de versión y la escritura incrementa la versión.
- **BD-27.** Las cuentas tienen nombre de usuario normalizado único; la unicidad no distingue mayúsculas de minúsculas.
- **BD-28.** Los roles tienen nombre único exacto; la comparación de duplicados distingue mayúsculas de minúsculas.
- **BD-29.** Las concesiones de permisos usan una clave compuesta por rol y permiso, lo que impide duplicados.
- **BD-30.** Las referencias de tickets de Mesa de Ayuda son únicas; son la clave de conciliación con el sistema institucional.
- **BD-31.** Las sesiones se guardan en base y su usuario puede ser nulo antes de autenticarse. Una sesión anónima existe antes del inicio de sesión.
- **BD-32.** La tabla de auditoría es de tipo **append-only** desde la aplicación: solo se insertan eventos; no hay operaciones de edición ni borrado.
- **BD-33.** La auditoría guarda actor, momento, módulo, tipo de entidad, identificador, acción y snapshots de antes/después en formato de documento.
- **BD-34.** El actor de auditoría puede ser nulo cuando la operación proviene de un asistente local, no de una cuenta.
- **BD-35.** La auditoría no guarda contraseñas, credenciales, sesiones ni secretos.
- **BD-36.** La auditoría **no se escribe con disparadores de base**. La escriben los servicios; una edición manual del archivo de datos queda fuera del historial.
- **BD-37.** La escala de impacto usa una clave compuesta por tipo y nivel, y una referencia compuesta desde los registros. Un registro no puede apuntar a una combinación inexistente.
- **BD-38.** El estado de un registro y sus campos de anulación son coherentes por restricción: un vigente no tiene datos de anulación y un anulado los tiene todos.
- **BD-39.** Las fechas del hecho se guardan como texto de calendario `AAAA-MM-DD` y tienen una comprobación de forma.
- **BD-40.** Los momentos del sistema se guardan como marcas de tiempo completas en hora universal.
- **BD-41.** Los textos con límites críticos —nombre de QA y detalle del registro— tienen comprobación de longitud en la base. Los demás límites de texto se validan en el servicio.
- **BD-42.** Los estados y tipos cerrados tienen comprobaciones de valores permitidos.
- **BD-43.** Las claves foráneas y las restricciones son la última defensa de integridad; no sustituyen los mensajes de validación del servicio.

**Búsqueda y texto**

- **BD-44.** La búsqueda por texto usa una función de normalización registrada al abrir la base.
- **BD-45.** La normalización convierte a minúsculas y conserva tildes y Ñ. No elimina acentos.
- **BD-46.** Los comodines de búsqueda se escapan antes de construir el patrón. `%`, `_` y `\` se buscan como texto literal.
- **BD-47.** La búsqueda de Personal QA y de detalle de registros usa la misma función de normalización y la misma regla de escape.
- **BD-48.** La búsqueda de tickets de Mesa de Ayuda es local sobre la copia cargada y no usa la base como motor de búsqueda remota.

**Índices**

- **BD-49.** Se indexan las rutas de consulta previstas: registros por QA y fecha, estado, tipo, impacto y fecha del hecho.
- **BD-50.** Se indexan los eventos de auditoría por entidad y fecha, y por fecha.
- **BD-51.** Se indexan las sesiones por usuario y por expiración.
- **BD-52.** Se indexan los tickets por referencia y estado, y los anexos por ticket.
- **BD-53.** Los índices son parte de la migración del módulo que los necesita; no se crean fuera del esquema.

**Inventario de datos**

| Tabla | Propósito | Módulo responsable |
| --- | --- | --- |
| Control de migraciones | Versión, nombre y fecha de cada migración aplicada. | Núcleo de datos |
| Roles | Nombre, protección y versión del rol. | Identidad |
| Permisos | Catálogo de claves conocidas y su descripción. | Identidad / núcleo de permisos |
| Concesiones de rol | Permisos asignados a cada rol. | Identidad |
| Cuentas | Nombre de usuario, credencial, rol, estado y versión. | Identidad / autenticación |
| Sesiones | Sesión opaca, usuario y expiración. | Núcleo de autenticación |
| Personal QA | Personas del catálogo, estado y versión. | Personal QA |
| Escala de impacto | Etiquetas y descripciones por tipo y nivel. | Méritos |
| Registros | Méritos e incidencias, estado, versión y anulación. | Méritos |
| Auditoría | Eventos inmutables con snapshots. | Núcleo de auditoría |
| Tickets de Mesa de Ayuda | Copia local de tickets y referencia externa. | Mesa de Ayuda |
| Anexos de Mesa de Ayuda | Metadatos de archivos guardados en disco. | Mesa de Ayuda |

**Límites de la base**

- **BD-54.** La base no está cifrada en reposo por el producto; la protección del archivo es responsabilidad externa.
- **BD-55.** No hay respaldos automáticos ni restauración desde la aplicación.
- **BD-56.** La base no se expone por red; solo la abre el proceso local.
- **BD-57.** Un cambio manual en el archivo de datos no pasa por la auditoría y queda fuera de la trazabilidad.
- **BD-58.** La estrategia de datos asume un solo proceso escritor y un uso local; no se diseña para escritura concurrente distribuida.

### 14.5 Backend: decisiones estructurales

**Arranque y composición**

- **BE-01.** El arranque abre la base, aplica migraciones, carga datos iniciales y solo después pone el servidor a escuchar.
- **BE-02.** Si falta el secreto de sesión o es demasiado corto, el arranque se niega a iniciar. No hay secreto por defecto.
- **BE-03.** El servidor solo escucha en direcciones loopback. Cualquier otra dirección aborta el arranque.
- **BE-04.** El servidor sirve la interfaz compilada cuando existe; si no existe, funciona solo como backend.
- **BE-05.** Los módulos se registran de forma explícita en el compositor del servidor. No hay descubrimiento dinámico.
- **BE-06.** El orden de registro es por código; un módulo nuevo se añade al compositor y se reinicia el proceso.
- **BE-07.** Los archivos estáticos solo se sirven si son archivos reales. Las rutas profundas de la interfaz reciben la página principal para que el enrutador del cliente las atienda.
- **BE-08.** Una ruta desconocida bajo el prefijo de operaciones conserva la respuesta de error estructurada; nunca devuelve la página principal.

**Autenticación y sesión**

- **BE-09.** La autenticación se resuelve en un complemento de entrada que se aplica antes de las rutas de negocio.
- **BE-10.** En métodos que modifican datos se valida que el equipo sea el propio, que el origen sea permitido y que una mutación autenticada traiga la protección anti-falsificación de la sesión.
- **BE-11.** Las mutaciones autenticadas exigen origen; las no autenticadas pueden omitirlo para el inicio de sesión.
- **BE-12.** Las sesiones son opacas y se guardan en base; no se guardan datos de negocio en la sesión.
- **BE-13.** La sesión se rota al iniciar sesión para evitar fijación.
- **BE-14.** La expiración es absoluta: ocho horas desde el inicio, sin renovación indefinida por actividad.
- **BE-15.** La sesión no sobrevive al cierre del navegador.
- **BE-16.** La cookie de sesión es solo para HTTP, mismo sitio estricto, ruta raíz y sin dominio. Se marca como no segura porque el producto solo funciona en loopback por HTTP; esa configuración no debe reutilizarse para red.
- **BE-17.** Las contraseñas se protegen con Argon2id y nunca se devuelven ni se registran.
- **BE-18.** Un usuario inexistente o desactivado se verifica contra un hash señuelo para igualar el tiempo de respuesta y no revelar si la cuenta existe.
- **BE-19.** El error de credenciales es genérico.
- **BE-20.** El límite de intentos fallidos es de cinco por cuenta normalizada en quince minutos y vive en memoria del proceso.
- **BE-21.** El límite en memoria es una decisión consciente de simplicidad local; se reinicia con el proceso y no se comparte entre instancias.
- **BE-22.** Desactivar una cuenta o restablecer su contraseña invalida sus sesiones.
- **BE-23.** Cambiar el rol o los permisos no invalida la sesión; el cambio se aplica en la siguiente petición.

**Autorización**

- **BE-24.** Cada ruta de negocio declara el permiso que exige.
- **BE-25.** El guardia de permisos resuelve la cuenta y sus permisos vigentes en cada petición.
- **BE-26.** Sin sesión se rechaza la operación; sin permiso se rechaza la operación; la diferencia se refleja en el error.
- **BE-27.** El actor se reconstruye desde la sesión, nunca desde el cuerpo de la petición.
- **BE-28.** La revocación de un permiso surte efecto en la siguiente petición sin recargar la interfaz.
- **BE-29.** La autorización no se delega a la interfaz ni a la ocultación de botones.

**Validación y contrato de operaciones**

- **BE-30.** Cada operación valida el cuerpo contra una lista blanca estricta. Un campo no declarado se rechaza.
- **BE-31.** Cada operación valida los parámetros de consulta contra una lista blanca.
- **BE-32.** Los identificadores de ruta deben ser enteros positivos.
- **BE-33.** Las respuestas usan envolturas estables: un recurso, una lista, una página con total, un resumen, un historial o una sesión.
- **BE-34.** Los errores usan una forma única con código y mensaje, sin trazas internas.
- **BE-35.** Los códigos de error previstos son: entrada inválida, no autenticado, prohibido, no encontrado, conflicto y demasiadas solicitudes.
- **BE-36.** Un error inesperado se responde como error interno genérico; el detalle no se expone al cliente.
- **BE-37.** Las operaciones de escritura no aceptan campos de auditoría ni identificadores de actor desde el cliente.
- **BE-38.** Los momentos de creación, actualización y anulación, y los campos de actor, los fija el servidor. La fecha del hecho la aporta la persona usuaria y el servidor la valida.
- **BE-39.** La paginación acepta únicamente los tamaños previstos y comienza en la página uno.
- **BE-40.** El listado y los totales comparten la misma construcción de filtros para que no puedan divergir.
- **BE-41.** La búsqueda de texto se parametriza y se escapa; no se concatena en la consulta.

**Servicio, repositorio y consistencia**

- **BE-42.** La ruta valida forma y permisos; el servicio aplica reglas; el repositorio ejecuta SQL.
- **BE-43.** Las escrituras que generan evento de auditoría comparten la misma transacción que ese evento.
- **BE-44.** Si falla la auditoría, no se confirma la escritura; si falla la escritura, no se crea el evento. La sincronización de Mesa de Ayuda es la excepción conocida, porque no genera evento.
- **BE-45.** Las entidades editables usan control optimista: una versión vieja produce conflicto y no sobrescribe.
- **BE-46.** Los campos de creación, actualización, actor y anulación los fija el servidor.
- **BE-47.** Los servicios no conocen HTTP ni React; reciben datos y actor, y devuelven resultados de dominio.
- **BE-48.** Los servicios no acceden a la sesión ni a la petición.
- **BE-49.** Los repositorios no aplican reglas de negocio; solo leen y escriben datos.
- **BE-50.** Las reglas se validan también en la base como última defensa.
- **BE-51.** Los módulos no comparten transacciones entre sí; cada operación es dueña de su consistencia.
- **BE-52.** La actualización de permisos de un rol es la excepción al control de versión: reemplaza el conjunto y la última escritura prevalece.
- **BE-53.** La sincronización de Mesa de Ayuda no es una transacción única; puede quedar parcial y se completa en una nueva sincronización.
- **BE-54.** El alta rápida de ticket crea primero en el sistema institucional y solo después guarda localmente; si el sistema remoto falla, no hay copia local.

**Contratos compartidos**

- **BE-55.** Los contratos son un paquete de fuentes, sin compilación propia y sin dependencia de la interfaz.
- **BE-56.** Los contratos contienen tipos, límites y formas de datos compartidas; no contienen acceso a datos ni reglas ejecutables.
- **BE-57.** Servidor e interfaz consumen los mismos nombres de campos y límites.
- **BE-58.** Los contratos no sustituyen la validación del servidor; solo describen la forma esperada.
- **BE-59.** Un cambio incompatible de contrato obliga a revisar servidor e interfaz de forma conjunta.

**Registro de módulos en la interfaz**

- **BE-60.** El registro de módulos es estático y declara, por módulo: identificador, ruta, etiqueta, grupo, descripción, carga de la pantalla y permiso requerido.
- **BE-61.** El menú, el enrutador y la guardia de acceso se derivan del registro; no se mantienen listas paralelas.
- **BE-62.** Si la cuenta no tiene el permiso requerido, el enlace no aparece y el acceso directo muestra acceso denegado sin montar la pantalla.
- **BE-63.** No existen permisos de menú separados del permiso funcional.
- **BE-64.** Un módulo sin pantalla no necesita entrada en el registro de interfaz.
- **BE-65.** La carga de la pantalla es diferida; el registro no importa todas las pantallas al inicio.
- **BE-66.** El registro no decide la autorización final; solo organiza la navegación.

### 14.6 Contrato de extensión de un módulo

Un módulo nuevo debe cumplir este contrato para integrarse sin romper el núcleo:

1. **Alcance y reglas.** Debe existir una decisión de producto sobre qué crea, quién lo ve, quién lo modifica y qué queda fuera.
2. **Permisos.** Debe declarar claves `modulo.accion` en el registro del servidor y en el espejo de la interfaz.
3. **Migración.** Debe traer una migración nueva con su esquema, restricciones e índices. No puede editar una migración ya aplicada.
4. **Datos iniciales.** Si necesita catálogos fijos, debe usar carga insert-only y no sobrescribir textos existentes.
5. **Contratos.** Si comparte tipos o límites con la interfaz, debe declararlos en el paquete común.
6. **Repositorio.** Debe contener SQL explícito y parametrizado, sin reglas de negocio.
7. **Servicio.** Debe aplicar reglas, control de versión cuando corresponda y auditoría en la misma transacción.
8. **Rutas.** Deben declarar permiso, lista blanca de campos, actor desde sesión, envolturas estables y errores del contrato común.
9. **Registro en el servidor.** Debe exportar su registrador y ser llamado desde el compositor del servidor.
10. **Registro en la interfaz.** Si tiene pantalla, debe añadir una entrada al registro con su permiso funcional.
11. **Propiedad de datos.** Las escrituras de sus tablas son suyas; las lecturas cruzadas son joins explícitos.
12. **Sin acoplamiento entre módulos.** No debe importar el servicio de otro módulo.
13. **Sin duplicación transversal.** Lo que necesiten dos módulos se promueve al núcleo o a contratos.
14. **Permiso automático del administrador.** El rol protegido recibe el permiso nuevo sin migración de concesiones.
15. **Sin borrado físico.** Las referencias históricas se protegen con `RESTRICT`.
16. **Sin carga en caliente.** El módulo existe para el usuario después de compilar la interfaz y reiniciar el servidor.
17. **Sin secretos.** No debe devolver ni auditar credenciales, sesiones o secretos.
18. **Sin diseño acoplado.** La arquitectura del módulo no decide la estética ni la disposición visual; eso queda fuera de este documento.

Decisiones:

- **MOD-01.** Un módulo se considera completo cuando tiene permiso, migración, repositorio, servicio, rutas, registro en servidor y, si aplica, pantalla registrada.
- **MOD-02.** Un módulo puede ser solo de backend si no necesita pantalla.
- **MOD-03.** Un módulo con varias capacidades declara varios permisos, pero una sola entrada de navegación.
- **MOD-04.** Un módulo no crea su propio sistema de sesión, auditoría, errores o permisos; usa el núcleo.
- **MOD-05.** Un módulo no crea su propia base de datos ni su propio archivo de datos.
- **MOD-06.** Un módulo no se instala en caliente ni se descubre por convención de carpetas.
- **MOD-07.** Un módulo no puede depender de que otro módulo esté cargado para funcionar.
- **MOD-08.** Un módulo puede leer tablas de otro módulo cuando la relación de negocio lo exige, pero no escribirlas.
- **MOD-09.** Un módulo que necesite una regla compartida debe promoverla al núcleo, no copiarla.
- **MOD-10.** Un módulo que necesite un tipo compartido debe usar contratos, no duplicar la forma.
- **MOD-11.** Un módulo que necesite una integración externa debe encapsularla detrás de una interfaz propia y ofrecer una implementación simulada para desarrollo y demostración.
- **MOD-12.** Un módulo con datos fijos debe declararlos en datos iniciales, no en el código de la pantalla.

### 14.7 Integración con Mesa de Ayuda

La Mesa de Ayuda es la única integración saliente y se trata como un límite arquitectónico, no como parte del núcleo.

Decisiones:

- **INT-01.** La integración se expresa como una interfaz de cliente con cuatro operaciones: obtener tickets por solicitante, obtener anexos de un ticket, descargar un anexo y crear un ticket.
- **INT-02.** Existe una implementación real contra la Mesa de Ayuda institucional y una implementación simulada con el mismo contrato.
- **INT-03.** La implementación se elige al arrancar. Si no hay configuración de conexión o si el modo simulado está activo, se usa la simulada.
- **INT-04.** El modo simulado sirve para demostración y desarrollo; sus tickets no son reales.
- **INT-05.** La fuente de verdad de tickets, estados y anexos es el sistema institucional.
- **INT-06.** La copia local se concilia por referencia externa única.
- **INT-07.** La sincronización crea o actualiza; nunca borra tickets ni anexos locales.
- **INT-08.** La sincronización no es atómica de principio a fin; un fallo a mitad deja lo ya procesado y se completa en otra ejecución.
- **INT-09.** El alta rápida crea primero en el sistema institucional y después guarda localmente.
- **INT-10.** Los anexos se guardan como archivos en disco y sus metadatos en base.
- **INT-11.** El directorio de anexos es local y queda fuera de la base y del control de versiones.
- **INT-12.** La integración no comparte transacciones con el sistema institucional; no hay confirmación distribuida.
- **INT-13.** No hay cola de reintento ni almacén de tickets pendientes. Si el sistema institucional no está disponible, el reporte falla.
- **INT-14.** La integración no vincula tickets con Personal QA, méritos o incidencias.
- **INT-15.** La integración no crea un historial visible de sincronización; solo el alta rápida deja evento local.
- **INT-16.** Las credenciales de la integración no se versionan y no se exponen en respuestas ni en auditoría.
- **INT-17.** El cliente real y el simulado deben respetar el mismo contrato para que el resto del módulo no sepa cuál está activo.
- **INT-18.** La integración se configura por variables de entorno: modo simulado, dirección del servicio, usuario y contraseña.
- **INT-19.** La ausencia de credenciales no rompe el arranque: activa el modo simulado. Es una decisión de continuidad local, no de producción.
- **INT-20.** La integración no se usa como fuente de permisos ni de identidad de QABase.

### 14.8 Seguridad y protección

- **SEG-01.** El producto no se expone a la red local ni a Internet. Solo acepta conexiones desde el propio equipo.
- **SEG-02.** Las mutaciones validan que el equipo sea loopback.
- **SEG-03.** Las mutaciones autenticadas validan un origen permitido y la protección anti-falsificación de la sesión.
- **SEG-04.** No se habilita un intercambio abierto de orígenes; los orígenes permitidos son los loopback esperados.
- **SEG-05.** El secreto de sesión es obligatorio y debe tener longitud suficiente; no existe valor por defecto.
- **SEG-06.** El secreto puede venir del entorno o de un archivo local generado en la puesta en marcha.
- **SEG-07.** Las sesiones son opacas, se guardan en servidor y se invalidan por desactivación o restablecimiento de contraseña.
- **SEG-08.** Las contraseñas se protegen con Argon2id y nunca se muestran ni se auditan.
- **SEG-09.** El inicio de sesión no revela si la cuenta existe.
- **SEG-10.** El límite de intentos reduce la fuerza bruta, con la limitación de que vive en memoria.
- **SEG-11.** El rol Administrador y el último administrador activo están protegidos en la capa de servicio, no solo en la interfaz.
- **SEG-12.** La autorización se aplica en el servidor en cada petición.
- **SEG-13.** La interfaz solo oculta acciones; no es una frontera de seguridad.
- **SEG-14.** Las respuestas de error no exponen trazas, consultas ni detalles internos.
- **SEG-15.** La auditoría no contiene secretos ni credenciales.
- **SEG-16.** La carpeta de datos no se sirve como contenido estático.
- **SEG-17.** El producto no incluye respaldos, cifrado en reposo ni recuperación ante pérdida del disco; son responsabilidades externas.
- **SEG-18.** La edición manual de los datos evita la auditoría y debe considerarse una operación fuera de la trazabilidad.

### 14.9 Decisiones descartadas

Para evitar que el sistema crezca en una dirección incompatible con su propósito, se descartan para esta arquitectura:

- **DES-01.** Microservicios y múltiples procesos de negocio.
- **DES-02.** Una base de datos por módulo.
- **DES-03.** Un ORM o una capa que oculte el SQL.
- **DES-04.** Carga de plugins o módulos en caliente.
- **DES-05.** Descubrimiento automático de módulos por carpeta.
- **DES-06.** Multiempresa o multiorganización.
- **DES-07.** Bus de eventos, colas distribuidas o event sourcing.
- **DES-08.** Bases de datos externas o servidores de base de datos.
- **DES-09.** Autenticación delegada a un proveedor externo.
- **DES-10.** Acceso por red local o Internet.
- **DES-11.** Migraciones destructivas automáticas o reversión automática.
- **DES-12.** Auditoría por disparadores de base.
- **DES-13.** Permisos por persona fuera del rol.
- **DES-14.** Permisos de menú separados de los permisos funcionales.
- **DES-15.** Almacenamiento de anexos dentro de la base.
- **DES-16.** Cola de tickets pendientes o reporte offline con reintento.
- **DES-17.** Vínculo automático entre tickets y registros de negocio.
- **DES-18.** Diseño visual, sistema de componentes, colores, tipografía o disposición de pantallas como parte de este documento.

### 14.10 Consecuencias y límites conocidos

Estas decisiones tienen consecuencias que deben asumirse:

- **LIM-01.** Un solo proceso y una sola base implican un punto único de ejecución y de datos. Es aceptable para el uso local previsto.
- **LIM-02.** SQLite tiene un escritor principal; el modo WAL y el tiempo de espera reducen bloqueos, pero no convierten el producto en una base distribuida.
- **LIM-03.** Los límites entre módulos se sostienen por convención y revisión, no por esquemas separados ni por procesos aislados.
- **LIM-04.** El registro estático de módulos exige recompilar la interfaz y reiniciar el servidor para que un módulo nuevo exista.
- **LIM-05.** No hay carga en caliente ni actualización de módulos sin reinicio.
- **LIM-06.** El runner de migraciones no detecta cambios en migraciones ya aplicadas; la disciplina de no editarlas es obligatoria.
- **LIM-07.** No hay reversión automática de una migración fallida o ya aplicada.
- **LIM-08.** El límite de intentos de inicio de sesión se pierde al reiniciar el proceso.
- **LIM-09.** La sincronización de Mesa de Ayuda puede quedar parcial y no genera un evento de historial.
- **LIM-10.** La edición de permisos de rol no tiene control de versión: la última escritura prevalece.
- **LIM-11.** Los anexos viven en disco y no están cubiertos por respaldos del producto.
- **LIM-12.** El directorio de anexos es local al directorio de ejecución, no necesariamente junto a una base configurada en otra ruta.
- **LIM-13.** El modo simulado de Mesa de Ayuda puede mostrar tickets de ejemplo que no son reales.
- **LIM-14.** La lista espejo de permisos de la interfaz puede quedar desactualizada; el servidor sigue siendo la autoridad.
- **LIM-15.** Una edición manual de la base no queda auditada.
- **LIM-16.** La arquitectura no ofrece alta disponibilidad, replicación ni escalado horizontal.
- **LIM-17.** La arquitectura no ofrece multiempresa, aislamiento por organización ni cuotas por equipo.
- **LIM-18.** La arquitectura no ofrece un motor genérico de flujos, aprobaciones o formularios dinámicos.

### 14.11 Requisitos arquitectónicos para un módulo nuevo

Un módulo nuevo se considera arquitectónicamente admisible solo si cumple:

- [ ] Tiene alcance de producto y reglas de negocio definidas.
- [ ] Declara sus permisos como `modulo.accion` en el servidor y en el espejo de la interfaz.
- [ ] Usa el rol Administrador protegido como receptor automático de los permisos nuevos.
- [ ] Trae una migración nueva, versionada y solo hacia adelante.
- [ ] No edita migraciones ya aplicadas.
- [ ] Usa datos iniciales insert-only si necesita catálogos fijos.
- [ ] Declara contratos compartidos si la interfaz necesita tipos o límites.
- [ ] Tiene repositorio con SQL explícito y parametrizado.
- [ ] Tiene servicio sin HTTP, sin sesión y sin React.
- [ ] Aplica auditoría en la misma transacción que la escritura.
- [ ] Usa versión y control optimista si la entidad es editable.
- [ ] Fija actor y fechas en el servidor.
- [ ] Tiene rutas con permiso, lista blanca y actor desde sesión.
- [ ] Usa las envolturas de respuesta y el contrato de errores existentes.
- [ ] Se registra explícitamente en el compositor del servidor.
- [ ] Se registra en la interfaz si tiene pantalla.
- [ ] No importa servicios de otros módulos.
- [ ] No crea su propia base, su propia sesión, su propia auditoría ni su propio manejador de errores.
- [ ] No borra físicamente datos de negocio.
- [ ] Protege las referencias históricas con `RESTRICT`.
- [ ] No expone secretos ni credenciales.
- [ ] Encapsula cualquier integración externa detrás de una interfaz con implementación simulada.
- [ ] No requiere carga en caliente; se activa al compilar y reiniciar.
- [ ] No introduce decisiones de diseño visual en este documento.

### 14.12 Variables de entorno y configuración

| Variable | Función | Regla |
| --- | --- | --- |
| `DATABASE_PATH` | Ruta del archivo de datos. | Si no se define, se usa `data/qabase.sqlite`. |
| `SESSION_SECRET` | Secreto de firma de sesión. | Obligatorio; si falta, se busca el archivo local generado en la puesta en marcha. Debe tener longitud suficiente. |
| `HOST` | Dirección de escucha. | Solo loopback; cualquier otra dirección aborta el arranque. |
| `PORT` | Puerto de escucha. | Por defecto 3000; los orígenes permitidos se derivan del puerto configurado. |
| `HELPDESK_USE_MOCK` | Fuerza el modo simulado de Mesa de Ayuda. | Por defecto simulado; solo se desactiva con el valor `false`. |
| `HELPDESK_API_URL` | Dirección del servicio institucional. | Tiene un valor por defecto; puede sustituirse por entorno. |
| `HELPDESK_USER` | Usuario de la integración. | Si falta junto con la contraseña, se activa el modo simulado. |
| `HELPDESK_PASSWORD` | Contraseña de la integración. | No se versiona ni se expone. Si falta, se activa el modo simulado. |

Reglas:

- **CFG-01.** Ninguna credencial se guarda en el repositorio.
- **CFG-02.** El modo simulado no debe confundirse con una conexión real; es una ayuda de desarrollo y demostración.
- **CFG-03.** Cambiar la configuración de integración exige reiniciar el proceso.
- **CFG-04.** La carpeta de anexos se resuelve como `data/attachments` relativa al directorio de ejecución, con independencia de una ruta de base configurada en otro lugar.
- **CFG-05.** La configuración no altera las reglas de negocio ni los permisos; solo cambia la infraestructura de ejecución.

---

*Fin del documento de negocio y arquitectura.*
