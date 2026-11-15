# Auditoría de ecuaciones de TermalWave (F01 a F17)

Revisión de las ecuaciones de `docs/science/_input/complemento.txt` (fichas F01 a F17 y fórmulas generales) y de las 21 formulaciones propuestas en `docs/science/_input/investigacion.txt`. Fecha de revisión: 15/11/2026.

Estados usados:

- **Correcta**: la ecuación coincide con la fuente primaria y sus unidades son consistentes.
- **Corregida**: la ecuación, su signo, su dominio o su forma de aplicación tenía un error y se da la versión corregida.
- **Necesita datos**: la forma es aceptable, pero sus coeficientes o su desempeño dependen de mediciones locales que todavía no existen.
- **No aplica a NISAR banda L**: la ecuación es válida, pero no usa el radar o exige polarizaciones que el modo habitual de NISAR sobre el área no adquiere.
- **Faltante**: la ficha necesita una ecuación que los insumos no traen.

Marcas de verificación de fuentes: **(V)** verificada en esta revisión contra la publicación o el documento oficial; **(I)** tomada de los insumos y coherente con la fuente conocida, sin nueva consulta; **(NV)** citada de memoria y no verificada en esta revisión.

Ninguna afirmación de este documento constituye validación local. No se han procesado datos de Santiago del Estero para esta auditoría.

## Resumen

| F | Nombre | Estado | Cambio clave |
|---|---|---|---|
| F01 | Retrodispersión y cambio | Corregida (aplicación) + faltantes | Promediar γ⁰ en potencia lineal y recién después pasar a dB. Se agregan ENL, sesgo del promedio en dB, umbral de cambio por distribución F y normalización de incidencia |
| F02 | SPI y SPEI | Correcta; necesita datos | ET₀ FAO-56 no es calculable con Tmax/Tmin/P solamente. Se agregan Hargreaves-Samani, auxiliares FAO-56 y estimador de Thom |
| F03 | Estado vegetal | Correcta + faltantes | Falta la conversión de nivel digital a reflectancia (offset −1000 en Sentinel-2 desde la línea de base 04.00). Se agregan RVI cuadripolar y su variante dual HH/HV |
| F04 | Humedad del suelo | Corregida + faltantes; necesita datos | σ⁰ = γ⁰ · `rtcGammaToSigmaFactor` por píxel. WCM en dominio lineal. Se agregan término de suelo, aproximación alfa, Topp, Dubois y Oh (estos dos no aplican en modo dual HH/HV) |
| F05 | Balance radicular | Corregida (menor) | Rama K_s = 0 y acotamiento 0 ≤ D_r ≤ TAW. Ajuste de p según ET_c. Cambio de símbolo p para no chocar con polarización |
| F06 | Agua e hidroperíodo | Correcta + faltantes | Se agrega detección de agua con radar (agua abierta y vegetación inundada) |
| F07 | Fuego activo | Correcta + faltante | Se agrega conversión FRE a biomasa quemada (0,368 kg/MJ) con su limitación |
| F08 | Quemado y severidad | Corregida (escala) + faltantes | Los umbrales de Key y Benson usan dNBR × 1000. Se agregan RdNBR, RBR y cambio de HV en banda L |
| F09 | Cobertura y desmonte | Correcta + faltante | Se agrega estimador estratificado de área de Olofsson y coeficiente de variación temporal de NISAR |
| F10 | Fenología y rendimiento | Correcta; necesita datos | Sin cambios de forma |
| F11 | Biomasa y carbono | Correcta; necesita datos | f_C = 0,47 (IPCC) como valor por defecto. Rango de requisito de NISAR (≤ 100 Mg/ha) compatible con el Chaco semiárido |
| F12 | Erosión y carbono del suelo | Correcta + faltante | Falta la erosividad R (EI₃₀), que exige lluvia subhoraria |
| F13 | Salinidad | Necesita datos | Se agrega la retransformación con corrección de sesgo |
| F14 | Temperatura superficial | Correcta; no aplica a NISAR | Sin cambios |
| F15 | Turbidez | Correcta; la adición rojo/NIR es sólida con condiciones; necesita datos | La combinación rojo/NIR es el esquema de conmutación de Dogliotti et al. (2015), no un NDVI. Se escribe completa |
| F16 | Humo y PM2,5 | Necesita datos | Conversión explícita de CAMS de kg/m³ a µg/m³ |
| F17 | Deformación | Corregida (signo) | La convención nativa de GUNW es fase positiva = alejamiento: ΔR = +λΔφ/(4π). La pantalla ionosférica no viene aplicada |

Ítems corregidos: **8** (F01 cálculo de ΔB, F04 conversión γ⁰→σ⁰, F04 índice W_t, F05 K_s y límites de D_r, F08 escala de dNBR, F16 unidades de CAMS, F17 signo, F17 corrección ionosférica). Fórmulas faltantes agregadas: 24, listadas en la sección final.

## Contexto común: NISAR sobre Santiago del Estero

- NISAR banda L: 1,257 GHz, λ ≈ 0,2385 m (24 cm). Banda S: 3,2 GHz, λ ≈ 9,4 cm. Incidencia 33° a 47°. Repetición de 12 días por trayectoria, con pasadas ascendentes y descendentes. **(V)** [ISRO/SAC, NISAR Utilization Programme](https://www.sac.gov.in/data/Event/524/NISAR_Utilization_Programme_Jul_2023.pdf), [NASA, polarimetría NISAR](https://science.nasa.gov/mission/nisar/polarimetry/).
- El modo dominante sobre tierras fuera de India y EE. UU. es banda L dual HH/HV. La banda S se adquiere sobre todo en India y en sitios de calibración. Para Santiago del Estero corresponde suponer **L, HH/HV**, salvo que el gránulo indique otra cosa. VV y el cuadripolar no deben presuponerse. **(V)** fuentes anteriores.
- GCOV entrega diagonales de la matriz de covarianza (`HHHH`, `HVHV`) en **potencia lineal γ⁰ con corrección radiométrica del terreno** (convención de Small, 2011), más `mask`, `numberOfLooks` y `rtcGammaToSigmaFactor`. **(V)** [ASF, GCOV](https://nisar-docs.asf.alaska.edu/gcov/), [Small 2011, doi:10.1109/TGRS.2011.2120616](https://doi.org/10.1109/TGRS.2011.2120616).
- El ruido equivalente del sistema es mejor que −25 dB. En HV sobre suelo desnudo seco del Chaco semiárido la señal puede acercarse a ese piso y quedar sesgada hacia arriba. **(V)** documento ISRO citado.
- El área de estudio es llana. Eso reduce los efectos de pendiente en la corrección del terreno, pero no elimina diferencias de incidencia entre trayectorias.

Regla común para todas las fichas radar: **toda suma, promedio, remuestreo o interpolación de γ⁰ o σ⁰ se hace en potencia lineal**. El paso a dB es el último. Un promedio de valores en dB es la media geométrica de la potencia, queda sesgado hacia abajo y su sesgo depende del número de looks.

---

## F01. Retrodispersión y cambio de superficie

**Ecuación original**

$$B_{p,t}=10\log_{10}(\gamma^0_{p,t}),\qquad \Delta B_p=10\log_{10}\left(\frac{\gamma^0_{p,t_2}}{\gamma^0_{p,t_1}}\right)$$

**Problemas**

1. Las dos ecuaciones son correctas para un píxel. El error posible está en la aplicación: si se agregan píxeles o parcelas, la media debe hacerse sobre γ⁰ lineal. Calcular ΔB como diferencia de medias en dB no es equivalente.
2. Falta un criterio estadístico para decidir si un ΔB es cambio o speckle. Con pocos looks, diferencias de 1 a 3 dB son compatibles con ausencia de cambio.
3. Falta la normalización de incidencia cuando se comparan trayectorias distintas. γ⁰ reduce, pero no elimina, la dependencia angular.
4. La salida vale para HH y HV por separado. No corresponde aplicar esta ficha a VV en el modo habitual sobre el área.

**Ecuación corregida**

Media de unidad espacial U, en lineal, con área a_i y máscara m_i:

$$\bar\gamma^0_{p,t}(U)=\frac{\sum_{i\in U}a_i\,m_{i,t}\,\gamma^0_{p,i,t}}{\sum_{i\in U}a_i\,m_{i,t}},\qquad B_{p,t}(U)=10\log_{10}\bar\gamma^0_{p,t}(U)$$

$$\Delta B_p(U)=10\log_{10}\frac{\bar\gamma^0_{p,t_2}(U)}{\bar\gamma^0_{p,t_1}(U)}$$

Sesgo de promediar en dB (intensidad con L looks, distribución gamma):

$$\mathrm{E}\left[10\log_{10}\gamma^0\right]=10\log_{10}\mu+\frac{10}{\ln 10}\left[\psi(L)-\ln L\right]$$

ψ es la función digamma. Con L = 1 el sesgo es −2,51 dB; con L = 10, alrededor de −0,22 dB.

Número equivalente de looks sobre una zona homogénea:

$$\widehat{ENL}=\frac{\bar I^{\,2}}{s_I^{2}}$$

Prueba de cambio por cociente. Sin cambio, con intensidades independientes de L₁ y L₂ looks equivalentes y la misma media:

$$r=\frac{\bar\gamma^0_{t_2}}{\bar\gamma^0_{t_1}}\sim F(2L_2,\,2L_1)$$

Se declara cambio si r < F_{α/2} o r > F_{1−α/2}. La varianza del cociente en dB es

$$\operatorname{Var}(\Delta B)=\left(\frac{10}{\ln 10}\right)^{2}\left[\psi_1(L_1)+\psi_1(L_2)\right]$$

con ψ₁ la función trigamma.

Normalización de incidencia, solo si se mezclan trayectorias:

$$B(\theta_{\mathrm{ref}})=B(\theta)-\beta\,(\theta-\theta_{\mathrm{ref}})$$

β en dB/grado, estimado por cobertura con la propia serie.

**Unidades y dominio.** γ⁰ adimensional y > 0. B y ΔB en dB. ΔB > 0 indica aumento de retrodispersión. L es el ENL efectivo, no necesariamente el `numberOfLooks` nominal. La prueba F supone independencia entre fechas y textura homogénea dentro de U.

**Supuestos.** Misma trayectoria, frecuencia, polarización, ancho de banda y versión de procesamiento. Píxeles fuera de `mask` excluidos antes de promediar.

**Fuentes primarias.** [Especificación GCOV Rev F](https://cumulus.asf.earthdatacloud.nasa.gov/PUBLIC/DATA/NISAR/NISAR_D-102274_RevF_NASA_SDS_Product_Specification_L2_GCOV_w-esigs.pdf) (I). [ASF, GCOV](https://nisar-docs.asf.alaska.edu/gcov/) (V). Prueba por cociente: Rignot y van Zyl (1993), doi:10.1109/36.239913 (NV). Estadística del logaritmo del speckle: Xie, Pierce y Ulaby (2002), doi:10.1109/36.992800 (NV). Normalización angular: Mladenova et al. (2013), doi:10.1109/TGRS.2012.2205264 (NV).

**Aplicabilidad NISAR y Santiago.** Aplica directamente con HHHH y HVHV de GCOV. En la llanura chaqueña la corrección de terreno es casi plana, así que la diferencia entre trayectorias ascendente y descendente viene sobre todo de la incidencia y de la orientación de surcos y cultivos. HV con valores muy bajos debe compararse con el piso de ruido.

**Dato para validar.** Zonas estables (techos, pavimento, suelo sin manejo) en varias fechas para estimar ENL y ruido de cambio. Visitas o imágenes independientes cercanas en fecha para atribuir causas.

---

## F02. Sequía meteorológica y déficit climático

**Ecuación original.** Acumulado X_{t,k}; gamma g(x); H(x) = q + (1 − q)G(x); SPI = Φ⁻¹[H(X)]; D_t = P_t − ET₀; log-logística F_D; SPEI = Φ⁻¹[F_D(D)]; ET₀ FAO-56 Penman-Monteith diaria.

**Problemas.** Las formas son correctas. Hay tres omisiones de aplicación:

1. D_t debe usar ET₀ **mensual** (suma de valores diarios, mm/mes). Mezclar mm/día con mm/mes invalida SPEI.
2. FAO-56 exige R_n, u₂ y e_a. El pipeline actual solo trae Tmax, Tmin y P, así que la ecuación no es ejecutable hoy.
3. Falta el método de estimación de α y β. Sin él, SPI no es reproducible.

**Ecuaciones agregadas**

Estimador de máxima verosimilitud aproximado de Thom para la gamma (sobre los n valores positivos):

$$A=\ln\bar x-\frac{1}{n}\sum\ln x,\qquad \hat\alpha=\frac{1}{4A}\left(1+\sqrt{1+\frac{4A}{3}}\right),\qquad \hat\beta=\frac{\bar x}{\hat\alpha}$$

Auxiliares FAO-56 (diarios):

$$e^\circ(T)=0.6108\exp\left(\frac{17.27\,T}{T+237.3}\right),\qquad \Delta=\frac{4098\,e^\circ(T)}{(T+237.3)^2}$$

$$P_{\mathrm{atm}}=101.3\left(\frac{293-0.0065z}{293}\right)^{5.26},\qquad \gamma=0.665\times10^{-3}P_{\mathrm{atm}}$$

$$e_s=\frac{e^\circ(T_{\max})+e^\circ(T_{\min})}{2},\qquad u_2=u_z\frac{4.87}{\ln(67.8z_u-5.42)},\qquad G_{\mathrm{día}}\approx0$$

Alternativa con solo temperatura (Hargreaves-Samani), con R_a en mm/día equivalentes (R_a[MJ m⁻² d⁻¹] × 0,408):

$$ET_0=0.0023\,(T_{\mathrm{media}}+17.8)\,(T_{\max}-T_{\min})^{0.5}\,R_a$$

**Unidades y dominio.** P, X, D, ET₀ en mm por paso. α adimensional, β en mm, q ∈ [0, 1). En FAO-56: T en °C, z en m, P_atm en kPa, u_z a altura z_u en m. ERA5 entrega viento a 10 m, que debe llevarse a 2 m con la fórmula anterior.

**Supuestos.** Ajuste separado por mes de cierre y por ventana k. Período base fijo de al menos 30 años. Hargreaves sobreestima en climas húmedos y subestima con viento fuerte; su uso debe declararse en la procedencia.

**Fuentes primarias.** [OMM, guía SPI (2012)](https://www.droughtmanagement.info/literature/WMO_standardized_precipitation_index_user_guide_en_2012.pdf) (I). Vicente-Serrano et al. (2010), doi:10.1175/2009JCLI2909.1 (I). Beguería et al. (2014), doi:10.1002/joc.3887 (I). [FAO-56, cap. 3](https://www.fao.org/4/X0490E/x0490e06.htm) (I). Thom (1958), doi:10.1175/1520-0493(1958)086<0117:ANOTGD>2.0.CO;2 (NV). Hargreaves y Samani (1985), doi:10.13031/2013.26773 (NV).

**Aplicabilidad NISAR y Santiago.** No usa radar. Es pertinente en el Chaco semiárido, donde la demanda atmosférica supera a la lluvia buena parte del año y SPEI discrimina mejor que SPI.

**Dato para validar.** Estaciones SMN o INTA con serie larga y homogénea, y radiación o viento medidos para contrastar ET₀.

---

## F03. Estado vegetal y estrés compatible con sequía

**Ecuación original.** NDVI = (ρ_NIR − ρ_rojo)/(ρ_NIR + ρ_rojo); NDMI = (ρ_NIR − ρ_SWIR1)/(ρ_NIR + ρ_SWIR1); z = (v − μ)/s.

**Problemas.** Las tres ecuaciones son correctas. Falta la conversión de nivel digital a reflectancia, que en Sentinel-2 cambió en 2022. Un índice normalizado no se altera por un factor de escala común, pero sí por un offset aditivo, así que omitirlo sesga NDVI y NDMI, sobre todo en superficies oscuras.

**Ecuaciones agregadas**

Sentinel-2 L2A (línea de base ≥ 04.00, y toda la reprocesada Collection-1):

$$\rho=\frac{DN+\mathrm{BOA\_ADD\_OFFSET}}{\mathrm{QUANTIFICATION\_VALUE}}\quad(\text{típicamente }(DN-1000)/10000),\qquad DN=0\Rightarrow\text{sin dato}$$

Landsat Collection 2 nivel 2, reflectancia de superficie:

$$\rho=2.75\times10^{-5}\,DN-0.2$$

Índice de vegetación radar, cuadripolar (potencias lineales):

$$RVI=\frac{8\,\sigma^0_{HV}}{\sigma^0_{HH}+\sigma^0_{VV}+2\,\sigma^0_{HV}}$$

Variante dual HH/HV, que resulta de suponer σ⁰_VV ≈ σ⁰_HH:

$$RVI_{\mathrm{dual}}=\frac{4\,\gamma^0_{HV}}{\gamma^0_{HH}+\gamma^0_{HV}}$$

Cociente de polarización cruzada, en lineal o en dB:

$$q_{\times}=\frac{\gamma^0_{HV}}{\gamma^0_{HH}}$$

**Unidades y dominio.** NDVI, NDMI ∈ [−1, 1]. RVI cuadripolar suele estar en (0, 1] con simetría de reflexión; **RVI_dual = 4γ⁰_HV/(γ⁰_HH+γ⁰_HV) no está acotado a [0, 1]** (máximo teórico 4 cuando HV domina). No usar RVI_dual como fracción de cobertura ni como humedad de suelo. Como `rtcGammaToSigmaFactor` es un factor geométrico por píxel, los cocientes entre polarizaciones de un mismo píxel son iguales en γ⁰ y en σ⁰. s_{v,d} > 0.

**Supuestos.** Reflectancias con máscara de nubes por píxel (SCL), no solo por escena. RVI_dual hereda el error del supuesto HH ≈ VV, que falla en suelo desnudo liso y en cultivos con estructura vertical.

**Fuentes primarias.** [USGS NDVI](https://www.usgs.gov/landsat-missions/landsat-normalized-difference-vegetation-index) (I). [USGS NDMI](https://www.usgs.gov/landsat-missions/normalized-difference-moisture-index) (I). Gao (1996), doi:10.1016/S0034-4257(96)00067-3 (I). Offset S2: [ESA STEP, PB 04.00](https://forum.step.esa.int/t/info-introduction-of-additional-radiometric-offset-in-pb04-00-products/35431) (V). Kim y van Zyl (2009), doi:10.1109/TGRS.2009.2014944 (V). Kim et al. (2012), doi:10.1109/LGRS.2011.2174772 (V). Szigarski et al. (2018), doi:10.3390/rs10111776 (V, análisis de variantes del RVI). Escala Landsat C2 SR: [USGS, Collection 2 Level-2](https://www.usgs.gov/landsat-missions/landsat-collection-2-level-2-science-products) (NV).

**Aplicabilidad NISAR y Santiago.** NDVI y NDMI no usan radar. RVI cuadripolar **no aplica** en el modo HH/HV; la variante dual y q_× sí aplican. En banda L, HV responde a la estructura leñosa del bosque chaqueño más que al follaje, así que RVI_dual y NDVI miden cosas distintas y su correlación debe medirse, no suponerse.

**Dato para validar.** Estado hídrico vegetal o contenido de agua de la vegetación en parcelas, simultáneo a pasadas.

---

## F04. Humedad del suelo superficial

**Ecuación original.** θ = V_agua/V_suelo; modelo de nube de agua (WCM) σ⁰_obs = A V₁ cos ι (1 − τ²) + τ² σ⁰_suelo, τ² = exp(−2BV₂/cos ι); σ⁰ ≈ η γ⁰; índice relativo W_t = (B_t − B_seco)/(B_húmedo − B_seco).

**Problemas**

1. **σ⁰ ≈ ηγ⁰.** GCOV trae el factor exacto por píxel. No hace falta una aproximación.
2. **WCM.** La forma es correcta (Attema y Ulaby, 1978), pero solo vale en potencia lineal. Es habitual modelar σ⁰_suelo lineal en dB con la humedad; si se suma ese término en dB con el de vegetación se obtiene un resultado sin sentido físico.
3. **W_t.** Es el método de detección de cambio de Wagner et al. (1999), correcto en forma. Le faltan la normalización de incidencia, la definición robusta de B_seco y B_húmedo y el recorte a [0, 1]. Sin eso, mezclar trayectorias produce saltos que parecen cambios de humedad.
4. Faltan el término de suelo del WCM y los modelos de inversión que el pedido menciona.

**Ecuaciones corregidas**

$$\sigma^0_{pp,i}=\gamma^0_{pp,i}\cdot\mathrm{rtcGammaToSigmaFactor}_i$$

Se aplica a resolución completa, antes de cualquier remuestreo. Solo si el factor falta, y sobre terreno llano, se admite σ⁰ ≈ γ⁰ cos θ_i con θ_i la incidencia sobre el elipsoide, declarándolo en la procedencia.

WCM con término de suelo empírico y dominio explícito:

$$\sigma^0_{\mathrm{obs}}=A\,V_1\cos\iota\,(1-\tau^2)+\tau^2\,10^{(C+D\theta)/10},\qquad \tau^2=\exp\left(-\frac{2BV_2}{\cos\iota}\right)$$

Inversión, válida solo si σ⁰_obs > σ⁰_veg:

$$\hat\theta=\frac{1}{D}\left[10\log_{10}\left(\frac{\sigma^0_{\mathrm{obs}}-A V_1\cos\iota(1-\tau^2)}{\tau^2}\right)-C\right]$$

Índice relativo corregido, con B normalizado a θ_ref (ver F01) y referencias por percentiles de la misma trayectoria:

$$W_t=\min\left\{1,\max\left\{0,\frac{B_t(\theta_{\mathrm{ref}})-B_{P05}}{B_{P95}-B_{P05}}\right\}\right\},\qquad \hat\theta_t=\theta_{\min}+W_t(\theta_{\max}-\theta_{\min})$$

θ_min y θ_max pueden tomarse del punto de marchitez y de la porosidad del suelo (SoilGrids o INTA), con su incertidumbre.

**Ecuaciones agregadas**

Aproximación alfa (cociente de series temporales, base de uno de los algoritmos de NISAR SME2):

$$\frac{\sigma^0_{pp}(t_2)}{\sigma^0_{pp}(t_1)}\approx\frac{|\alpha_{pp}(\varepsilon_2,\theta)|^2}{|\alpha_{pp}(\varepsilon_1,\theta)|^2}$$

$$\alpha_{HH}=\frac{\varepsilon-1}{\left(\cos\theta+\sqrt{\varepsilon-\sin^2\theta}\right)^2},\qquad \alpha_{VV}=\frac{(\varepsilon-1)\left[\sin^2\theta-\varepsilon(1+\sin^2\theta)\right]}{\left(\varepsilon\cos\theta+\sqrt{\varepsilon-\sin^2\theta}\right)^2}$$

Relación permitividad-humedad de Topp (empírica, sin dependencia de textura):

$$\varepsilon=3.03+9.3\,\theta+146\,\theta^2-76.7\,\theta^3$$

Para suelos con mucha arcilla o sales, el modelo de Mironov (2009) es preferible; no se transcribe aquí.

Algoritmo multiescala de NISAR SME2 (σ en dB; F = fina, C = gruesa de 9 km):

$$\theta_F=\theta_C+\beta_C\left\{\left[\sigma_{HH,F}-\sigma_{HH,C}\right]+\Gamma\left[\sigma_{HV,C}-\sigma_{HV,F}\right]\right\}$$

La agrupación de β_C sobre ambos corchetes sigue la forma del algoritmo activo-pasivo de SMAP; conviene confirmarla en el ATBD de SME2 antes de implementarla.

Dubois et al. (1995), suelo desnudo, lineal, λ en cm:

$$\sigma^0_{HH}=10^{-2.75}\frac{\cos^{1.5}\theta}{\sin^{5}\theta}10^{0.028\varepsilon\tan\theta}(ks\sin\theta)^{1.4}\lambda^{0.7}$$

$$\sigma^0_{VV}=10^{-2.35}\frac{\cos^{3}\theta}{\sin^{3}\theta}10^{0.046\varepsilon\tan\theta}(ks\sin\theta)^{1.1}\lambda^{0.7}$$

Oh et al. (1992), suelo desnudo:

$$p=\frac{\sigma^0_{HH}}{\sigma^0_{VV}}=\left[1-\left(\frac{2\theta}{\pi}\right)^{1/(3\Gamma_0)}e^{-ks}\right]^2,\qquad q=\frac{\sigma^0_{HV}}{\sigma^0_{VV}}=0.23\sqrt{\Gamma_0}\,(1-e^{-ks}),\qquad \Gamma_0=\left|\frac{1-\sqrt\varepsilon}{1+\sqrt\varepsilon}\right|^2$$

**Unidades y dominio.** θ (humedad) en m³/m³; θ (ángulo) en radianes dentro de las fórmulas. σ⁰ lineal. A en unidades de σ⁰ por unidad de V₁; B en inversa de V₂; C en dB; D en dB por m³/m³. Dubois: ks ≤ 2,5, humedad ≤ 0,35 m³/m³, θ ≥ 30°, NDVI < 0,4. Oh 1992: 0,1 < ks < 6, 0,09 < humedad < 0,31 m³/m³. La aproximación alfa supone rugosidad y vegetación constantes entre t₁ y t₂.

**Supuestos.** Humedad de los primeros centímetros (en banda L, del orden de 5 cm según humedad). Sin laboreo ni cosecha entre fechas del cociente.

**Fuentes primarias.** Attema y Ulaby (1978), doi:10.1029/RS013i002p00357 (I). Wagner, Lemoine y Rott (1999), doi:10.1016/S0034-4257(99)00036-X (V). [ASF, rtcGammaToSigmaFactor en GCOV](https://nisar-docs.asf.alaska.edu/gcov/) (V). [ASF, SME2](https://nisar-docs.asf.alaska.edu/sme2/) (V). Balenzano et al. (2011), doi:10.1109/JSTARS.2010.2052916 (V). Kim y Bindlish, IGARSS 2021, [NTRS 20210022269](https://ntrs.nasa.gov/api/citations/20210022269/downloads/Jeonghwan_Bindlish_IGARSS2021.pdf) (V). Lal et al., algoritmo multiescala NISAR, doi:10.48577/jpl.rkgylc (V). Dubois, van Zyl y Engman (1995), doi:10.1109/36.406677 (V). Oh, Sarabandi y Ulaby (1992), doi:10.1109/36.134086 (V; el DOI terminado en 134085 es incorrecto). Topp, Davis y Annan (1980), doi:10.1029/WR016i003p00574 (NV). Mironov et al. (2009), doi:10.1109/TGRS.2008.2011631 (NV).

**Aplicabilidad NISAR y Santiago.** Aplican con HH/HV: WCM, W_t, aproximación alfa con HH y el algoritmo multiescala. **No aplican en modo dual HH/HV**: Dubois (necesita HH y VV) y Oh (necesita HH, VV y HV). Solo serían utilizables con un gránulo cuadripolar. En el Chaco semiárido, el bosque y el arbustal leñoso limitan W_t porque HV y HH responden a troncos y ramas; la inversión es más defendible en lotes agrícolas sin cultivo o con cultivo bajo. El requisito de NISAR (ubRMSE 0,06 m³/m³ donde el agua de vegetación es < 5 kg/m²) no está demostrado para esta zona.

**Dato para validar.** Sensores de humedad a 5 cm o muestreo gravimétrico simultáneo a pasadas, en lotes y en monte, durante al menos un ciclo húmedo y uno seco. Rugosidad medida en lotes desnudos si se prueba Dubois u Oh con datos cuadripolares.

---

## F05. Balance radicular y riego

**Ecuación original.** D_{r,t} = D_{r,t−1} − (P − RO) − I − CR + ET_c + DP; TAW = 1000(θ_FC − θ_WP)Z_r; RAW = p·TAW; K_s por tramos; ET_c = (K_s K_cb + K_e)ET₀.

**Problemas.** Todas coinciden con FAO-56 (ecuaciones 80, 82, 83, 84 y 85). Falta el tramo D_r > TAW y el acotamiento de D_r que FAO-56 impone (ecuación 86). Falta el ajuste de p por demanda. El símbolo p choca con la polarización de F01.

**Ecuación corregida**

$$0\le D_{r,t}\le TAW,\qquad K_s=\begin{cases}1,&D_r\le RAW\\[4pt]\dfrac{TAW-D_r}{(1-p_{\mathrm{FAO}})\,TAW},&RAW<D_r\le TAW\\[4pt]0,&D_r>TAW\end{cases}$$

$$p_{\mathrm{FAO}}=p_{\mathrm{tabla}}+0.04\,(5-ET_c),\qquad 0.1\le p_{\mathrm{FAO}}\le0.8$$

**Unidades y dominio.** Láminas en mm por día. θ_FC, θ_WP en m³/m³. Z_r en m. ET_c en mm/día en la corrección de p. K_s, K_cb, K_e adimensionales.

**Supuestos.** Paso diario. DP solo cuando el agua supera capacidad de campo. Con napa cercana, CR no es despreciable.

**Fuente primaria.** [FAO-56, cap. 8](https://www.fao.org/4/X0490E/x0490e0e.htm) (I).

**Aplicabilidad NISAR y Santiago.** El balance no usa radar. La humedad superficial de F04 solo puede entrar mediante un operador de observación que respete la profundidad (ver P20). En el área de riego del Río Dulce, ignorar riego o napa atribuye al clima efectos del manejo.

**Dato para validar.** Perfiles de humedad, láminas de riego medidas y fechas de siembra y cosecha.

---

## F06. Agua superficial, inundación e hidroperíodo

**Ecuación original.** MNDWI = (ρ_verde − ρ_SWIR1)/(ρ_verde + ρ_SWIR1); A_t = Σ a_i I_{i,t}; O_i = Σ m I / Σ m; HAND_i = z_i − z_{d(i)}.

**Problemas.** Correctas. Falta la regla radar, que es la que aporta NISAR bajo nubes.

**Ecuaciones agregadas**

Agua abierta (retrodispersión especular baja) y vegetación inundada (doble rebote que eleva HH):

$$I^{\mathrm{abierta}}_{i,t}=\mathbf 1\left[B_{HH,i,t}<T_w\right],\qquad I^{\mathrm{veg.inund}}_{i,t}=\mathbf 1\left[B_{HH,i,t}>T_{fv}\ \wedge\ \frac{\gamma^0_{HH}}{\gamma^0_{HV}}>T_r\right]$$

Los umbrales T_w, T_fv y T_r se calibran con la propia serie (por ejemplo, método de Otsu sobre el histograma local) y con perímetros de referencia. El ATBD de inundación de NISAR usa umbrales sobre HH, HV, su producto y su cociente.

Superficie en hectáreas:

$$A_t[\mathrm{ha}]=\frac{1}{10^4}\sum_i a_i\,I_{i,t}$$

**Unidades y dominio.** MNDWI ∈ [−1, 1] describe **agua superficial óptica**, no humedad volumétrica del suelo (eso es F04: W_t, WCM o inversión calibrada). B en dB. a_i en m². HAND en m, ≥ 0 en la red conectada.

**Supuestos.** Viento sobre agua abierta eleva la retrodispersión y produce omisiones. Superficies lisas secas (suelo desnudo compactado, salinas) imitan agua abierta en HH.

**Fuentes primarias.** Xu (2006), doi:10.1080/01431160600589179 (I). Nobre et al. (2011), [J. Hydrol.](https://www.sciencedirect.com/science/article/pii/S0022169411002599) (I). Descripción de ATBD de inundación de NISAR: [OSTI 2441094](https://www.osti.gov/servlets/purl/2441094) (V). Otsu (1979), doi:10.1109/TSMC.1979.4310076 (NV).

**Aplicabilidad NISAR y Santiago.** Banda L penetra el dosel del monte y detecta inundación bajo vegetación mejor que banda C. En los bañados y en el valle del Río Dulce aplica. Los umbrales no se trasladan de otras regiones.

**Dato para validar.** Perímetros fechados de anegamiento, fotografías y niveles del río. Reportar IoU y error de área.

---

## F07. Fuego activo y riesgo

**Ecuación original.** FRE ≈ Σ (FRP_j + FRP_{j+1})/2 · (t_{j+1} − t_j).

**Problemas.** Correcta (MW × s = MJ). Falta la conversión a biomasa, que es la razón habitual de calcular FRE.

**Ecuación agregada**

$$M=\beta_{\mathrm{FRE}}\cdot FRE,\qquad \beta_{\mathrm{FRE}}=0.368\pm0.015\ \mathrm{kg\,MJ^{-1}}$$

**Unidades y dominio.** FRP en MW, t en s, FRE en MJ, M en kg de materia seca. β_FRE se obtuvo en fuegos experimentales, mayormente de Miscanthus; otros trabajos reportan valores cercanos a 0,45 kg/MJ.

**Supuestos.** Muestreo temporal denso. Con dos o cuatro pasadas diarias de VIIRS y MODIS, la integral trapezoidal subestima o sobreestima según el ciclo diurno del fuego.

**Fuentes primarias.** [FIRMS](https://firms.modaps.eosdis.nasa.gov/api/area/) (I). Wooster et al. (2005), doi:10.1029/2005JD006318 (V).

**Aplicabilidad NISAR y Santiago.** No usa radar. La deduplicación de 1 km y 12 h del código elimina observaciones intermedias del mismo foco, y eso impide integrar FRE (ver "Coincidencia con el código").

**Dato para validar.** Registros de eventos con hora de inicio y fin y, si existe, carga de combustible medida.

---

## F08. Quemado, severidad y recuperación

**Ecuación original.** NBR = (ρ_NIR − ρ_SWIR2)/(ρ_NIR + ρ_SWIR2); dNBR = NBR_antes − NBR_después; contraste con control Δ_t (diferencia en diferencias).

**Problemas.** Las ecuaciones son correctas. Los umbrales de severidad de Key y Benson están expresados en **dNBR × 1000**. Comparar un dNBR sin escalar (rango −2 a 2) con esos umbrales clasifica todo como "sin quemar".

**Ecuación corregida y agregadas**

$$dNBR_{\times1000}=1000\,(NBR_{\mathrm{antes}}-NBR_{\mathrm{después}})$$

Relativizado de Miller y Thode (2007), con dNBR en escala × 1000:

$$RdNBR=\frac{dNBR_{\times1000}}{\sqrt{\left|NBR_{\mathrm{antes}}\right|}},\qquad \left|NBR_{\mathrm{antes}}\right|<0.001\Rightarrow0.001$$

Cociente relativizado de Parks et al. (2014), con NBR sin escalar:

$$RBR=\frac{dNBR}{NBR_{\mathrm{antes}}+1.001}$$

Indicador radar en banda L (pérdida de volumen leñoso):

$$\Delta B_{HV}=10\log_{10}\frac{\bar\gamma^0_{HV,\mathrm{después}}}{\bar\gamma^0_{HV,\mathrm{antes}}}$$

Se espera ΔB_HV < 0 tras la pérdida de copa y ramas. La prueba de significación es la de F01.

**Unidades y dominio.** NBR ∈ [−1, 1]. dNBR × 1000 aproximadamente en [−2000, 2000]. Fechas antes y después en la misma fenología.

**Supuestos.** Para ΔB_HV, misma trayectoria y humedad de suelo comparable. Una lluvia entre fechas eleva HH y HV y puede enmascarar la caída.

**Fuentes primarias.** Key y Benson, [FIREMON](https://research.fs.usda.gov/treesearch/24066) (I). Miller y Thode (2007), doi:10.1016/j.rse.2006.12.006 (V a través de [Miller et al. 2009](https://www.fs.usda.gov/psw/publications/knapp/psw_2009_knapp(miller)001.pdf)). Parks, Dillon y Miller (2014), doi:10.3390/rs6031827 (V). Sensibilidad de banda L a severidad: Tanase et al. (2010), doi:10.1109/TGRS.2010.2049653 (NV).

**Aplicabilidad NISAR y Santiago.** NBR y sus variantes son ópticos. ΔB_HV aplica con NISAR y sirve con nubes o humo. En pastizales y arbustales bajos el cambio de HV puede ser pequeño.

**Dato para validar.** Parcelas con índice compuesto de quemado (CBI) o mortalidad, y perímetros independientes.

---

## F09. Cobertura, uso y desmonte

**Ecuación original.** Softmax multiclase; y_t = T_t + S_t + ε_t con S_t armónica (BFAST).

**Problemas.** Correctas. Falta la estimación de área con su error, que es lo que permite informar hectáreas desmontadas sin sesgo de clasificación.

**Ecuaciones agregadas**

Estimador estratificado (estratos h del mapa, peso de área W_h, matriz de muestra n_{hk}):

$$\hat p_{\cdot k}=\sum_h W_h\frac{n_{hk}}{n_{h\cdot}},\qquad \hat A_k=A_{\mathrm{tot}}\,\hat p_{\cdot k}$$

$$\widehat{SE}(\hat p_{\cdot k})=\sqrt{\sum_h W_h^2\,\frac{\frac{n_{hk}}{n_{h\cdot}}\left(1-\frac{n_{hk}}{n_{h\cdot}}\right)}{n_{h\cdot}-1}}$$

Coeficiente de variación temporal de γ⁰ (base del ATBD de área de cultivo de NISAR), en lineal:

$$CV_i=\frac{s\left(\gamma^0_{i,t}\right)}{\bar\gamma^0_{i}}$$

**Unidades y dominio.** p̂ ∈ [0, 1]. Â en las unidades de A_tot. CV adimensional; requiere al menos tres meses de serie.

**Supuestos.** Muestra probabilística de referencia, independiente del mapa.

**Fuentes primarias.** Verbesselt et al. (2010), [RSE](https://www.sciencedirect.com/science/article/pii/S003442570900265X) (I). Olofsson et al. (2014), [RSE](https://www.sciencedirect.com/science/article/pii/S0034425714000704) (I). ATBD de cultivo y disturbio de NISAR, resumen en [OSTI 2441094](https://www.osti.gov/servlets/purl/2441094) (V).

**Aplicabilidad NISAR y Santiago.** El desmonte en el Chaco produce una caída fuerte y persistente de HV en banda L, que se detecta con F01 y BFAST sobre la serie de HV. Cosecha e incendio también bajan HV; la persistencia en el tiempo es lo que los separa.

**Dato para validar.** Muestra de referencia interpretada en imágenes de alta resolución o en campo, independiente de MapBiomas si este se usa para entrenar.

---

## F10. Fenología y rendimiento

**Ecuación original.** GDD_t = max(0, (Tmax + Tmin)/2 − T_b); GDD acumulado; t_inicio; I_v; regresión de rendimiento.

**Problemas.** GDD es el método de promedio simple, correcto. Como variante, algunos cultivos usan el método que recorta Tmin y Tmax a T_b antes de promediar; debe declararse cuál se usa. Las demás son hipótesis calibrables, correctamente planteadas.

**Ecuación corregida.** Sin cambios.

**Unidades y dominio.** °C y °C·día. Y en t/ha; I_v en índice·día.

**Fuentes primarias.** McMaster y Wilhelm (1997), doi:10.1016/S0168-1923(97)00027-0 (NV). [MOD13Q1](https://doi.org/10.5067/MODIS/MOD13Q1.061) (I).

**Aplicabilidad NISAR y Santiago.** La serie de HH y HV de NISAR cada 12 días puede reemplazar a la óptica en campañas nubladas para detectar emergencia y cierre de cultivo, pero la relación con NDVI debe calibrarse.

**Dato para validar.** Fechas de siembra y cosecha y rendimientos pesados por lote.

---

## F11. Biomasa leñosa y carbono

**Ecuación original.** AGB_j = 0,0673(ρD²H)^0,976; AGBD = ΣAGB/(1000 A); C = f_C·AGBD; Var(ΔAGBD).

**Problemas.** Correctas, con las unidades declaradas (kg, g/cm³, cm, m, ha, Mg/ha). Falta un valor por defecto de f_C y la referencia al requisito de NISAR.

**Ecuación agregada**

$$C=0.47\cdot AGBD\quad(\text{f}_C\text{ por defecto del IPCC, a reemplazar por valor local si existe})$$

Requisito de misión: AGB anual a 1 ha con error cuadrático medio ≤ 20 Mg/ha en al menos 80 % de las áreas con AGB ≤ 100 Mg/ha. El algoritmo es un modelo semiempírico de retrodispersión sobre HH y HV multitemporales, calibrado con lidar y parcelas por ecorregión. No se transcribe su forma exacta porque no se ha verificado en el ATBD.

**Unidades y dominio.** Mg/ha y Mg C/ha. La ecuación de Chave et al. se ajustó con D ≥ 5 cm.

**Fuentes primarias.** Chave et al. (2014), doi:10.1111/gcb.12629 (I). [NISAR Vegetation Biomass Workshop Report](https://assets.science.nasa.gov/content/dam/science/missions/nisar/nisar-jpl/pdf/NISAR_Vegetation_Biomass_Workshop_Report.pdf) (V). Ramachandran et al., [OSTI 3002772](https://www.osti.gov/servlets/purl/3002772) (V). IPCC (2006), vol. 4, cap. 4, cuadro 4.3 (NV).

**Aplicabilidad NISAR y Santiago.** El bosque chaqueño semiárido cae mayormente dentro del rango donde banda L no satura, así que la aplicación es pertinente. Especies multicaules (por ejemplo, del género Prosopis) pueden necesitar ecuaciones locales.

**Dato para validar.** Parcelas de inventario de 0,25 a 1 ha con D, H y especie, idealmente con lidar aerotransportado o GEDI.

---

## F12. Degradación, erosión y carbono del suelo

**Ecuación original.** A = R K L S C P_s; SOC_stock = 10 c ρ_b d (1 − f_g).

**Problemas.** Correctas en unidades SI. Falta cómo se calcula R, que la investigación menciona pero no formula. El residual r_t (P8) es una hipótesis correcta.

**Ecuaciones agregadas**

$$R=\frac{1}{n}\sum_{j=1}^{n}\sum_{k=1}^{m_j}\left(E\,I_{30}\right)_k,\qquad E=\sum_r e_r\,\Delta V_r,\qquad e_r=0.29\left[1-0.72\exp(-0.05\,i_r)\right]$$

e_r en MJ ha⁻¹ mm⁻¹, i_r intensidad en mm/h, ΔV_r lámina del intervalo en mm, I₃₀ en mm/h. RUSLE2 usa 0,082 en lugar de 0,05 en el exponente.

**Unidades y dominio.** A en t ha⁻¹ año⁻¹; R en MJ mm ha⁻¹ h⁻¹ año⁻¹; K en t h MJ⁻¹ mm⁻¹. SOC en Mg C/ha con c en g/kg, ρ_b en Mg/m³ y d en m.

**Supuestos.** R requiere lluvia subhoraria de varios años. La lluvia diaria de ERA5 o CHIRPS no alcanza; corresponde usar un mapa regional de R con su procedencia.

**Fuentes primarias.** [USDA, RUSLE AH-703](https://www.ars.usda.gov/ARSUserFiles/60600505/RUSLE/AH_703%20-%20Predicting%20Soil%20Erosion%20by%20Water%20-%20A%20Guide%20to%20Conservation%20Planning%20With%20the%20RUSLE%20%28RUSLE%29.pdf) (I). Brown y Foster (1987), doi:10.13031/2013.31957 (NV). Panagos et al. (2017), mapa global de erosividad, doi:10.1038/s41598-017-04282-8 (NV).

**Aplicabilidad NISAR y Santiago.** No usa radar. RUSLE no cubre la erosión eólica, que en el Chaco semiárido con suelo desnudo puede ser dominante.

**Dato para validar.** Parcelas de escurrimiento o trampas de sedimento, y núcleos de suelo con densidad aparente medida.

---

## F13. Salinidad y sodicidad

**Ecuación original.** log(ECe/EC_ref) = β₀ + βᵀx + u_zona + ε (formulación P9).

**Problemas.** La forma es aceptable como hipótesis. El texto dice que la retransformación debe corregir el sesgo pero no da la fórmula.

**Ecuación agregada.** Con logaritmo natural y residuos ε̂_i del ajuste:

$$\widehat{ECe}=EC_{\mathrm{ref}}\exp(\hat\eta)\cdot\frac{1}{n}\sum_{i=1}^{n}e^{\hat\varepsilon_i}\quad(\text{Duan}),\qquad \widehat{ECe}\approx EC_{\mathrm{ref}}\exp\left(\hat\eta+\tfrac{\hat\sigma^2}{2}\right)\quad(\text{si }\varepsilon\text{ es normal})$$

η̂ = β̂₀ + β̂ᵀx + û_zona.

**Unidades y dominio.** ECe en dS/m, EC_ref = 1 dS/m.

**Fuentes primarias.** [FAO, calidad de agua para agricultura](https://www.fao.org/4/t0234e/t0234e00.htm) (I). Duan (1983), doi:10.1080/01621459.1983.10478017 (NV).

**Aplicabilidad NISAR y Santiago.** La salinidad modifica la parte imaginaria de la permitividad, a la que banda L es sensible en suelo húmedo, pero no hay un método operativo verificado. Se considera exploratorio.

**Dato para validar.** ECe de laboratorio a profundidades definidas, en campañas húmedas y secas.

---

## F14. Temperatura superficial

**Ecuación original.** T_s[K] = 0,00341802·DN + 149,0; T_s[°C] = T_s[K] − 273,15; ΔT = T_s − μ.

**Problemas.** Correctas para Landsat Collection 2 nivel 2, banda ST_B10. DN = 0 es sin dato.

**Ecuación corregida.** Sin cambios.

**Unidades y dominio.** K o °C. La anomalía es una diferencia y vale igual en K que en °C.

**Fuente primaria.** [USGS, Landsat C2 ST](https://www.usgs.gov/landsat-missions/landsat-collection-2-surface-temperature) (I).

**Aplicabilidad NISAR y Santiago.** **No aplica a NISAR**: el radar no mide temperatura. La resolución térmica nativa de Landsat 8 y 9 es 100 m aunque la grilla sea de 30 m.

**Dato para validar.** Radiometría de superficie en campo.

---

## F15. Turbidez y sedimentos

**Ecuación original**

$$T=\frac{A_T\,\rho_w}{1-\rho_w/C_T}$$

**Problemas.** La forma es correcta y coincide con Nechad et al. y Dogliotti et al. Falta precisar que ρ_w es la reflectancia del agua definida como πL_w/E_d(0⁺), es decir π·R_rs.

**Evaluación de la adición rojo/NIR.** La combinación de una banda roja y una NIR es una adición deliberada al método. Se ha evaluado y es sólida. La combinación que se sostiene es la conmutación de bandas de Dogliotti et al. (2015), no un índice normalizado:

- En banda roja (645 nm) el algoritmo es casi lineal a turbidez baja, pero satura a turbidez alta.
- En NIR (859 nm) la absorción del agua pura (alrededor de 4,4 m⁻¹) evita la saturación, pero la sensibilidad es baja con agua clara.
- La conmutación usa la roja con agua clara, la NIR con agua turbia y una mezcla lineal en la transición.

Si la adición se entendiera como un cociente normalizado (ρ_NIR − ρ_rojo)/(ρ_NIR + ρ_rojo) sobre agua, eso es un NDVI aplicado a agua. **No es un estimador de turbidez.** Sirve como máscara: valores cercanos a cero o positivos sobre agua indican vegetación flotante, macrófitas, floraciones superficiales o contaminación del píxel por la orilla. Se recomienda usarlo así, para excluir píxeles antes de aplicar T, y no como variable de turbidez.

**Ecuación corregida (esquema completo)**

$$T_\lambda=\frac{A_T^\lambda\,\rho_w(\lambda)}{1-\rho_w(\lambda)/C^\lambda},\qquad \rho_w=\pi R_{rs}$$

$$T=\begin{cases}T_{645},&\rho_w(645)<0.05\\[2pt](1-w)\,T_{645}+w\,T_{859},&0.05\le\rho_w(645)\le0.07,\quad w=\dfrac{\rho_w(645)-0.05}{0.02}\\[4pt]T_{859},&\rho_w(645)>0.07\end{cases}$$

Coeficientes publicados para bandas MODIS: A_T⁶⁴⁵ = 228,1 FNU, C⁶⁴⁵ = 0,1641; A_T⁸⁵⁹ = 3078,9 FNU, C⁸⁵⁹ = 0,2112.

Máscara opcional de vegetación flotante (umbral a calibrar):

$$\mathrm{excluir}\ i\ \text{si}\ \frac{\rho_{\mathrm{NIR}}-\rho_{\mathrm{rojo}}}{\rho_{\mathrm{NIR}}+\rho_{\mathrm{rojo}}}>T_{\mathrm{veg}}$$

**Unidades y dominio.** T en FNU; ρ_w adimensional; R_rs en sr⁻¹; C adimensional. El cociente diverge cuando ρ_w → C.

**Supuestos.** Corrección atmosférica acuática. Sentinel-2 L2A (Sen2Cor) no está diseñado para agua; conviene un procesador acuático desde L1C. Las bandas de Sentinel-2 más cercanas son B4 (665 nm) y B8A (865 nm), cuyos coeficientes no son los de MODIS y deben tomarse de las tablas por longitud de onda de Nechad et al. (2010) o recalibrarse. Los umbrales 0,05 y 0,07 se derivaron en aguas costeras y estuarinas.

**Fuentes primarias.** Dogliotti et al. (2015), doi:10.1016/j.rse.2014.09.020 (V; coeficientes y umbrales confirmados en el texto). Nechad, Ruddick y Park (2010), doi:10.1016/j.rse.2009.11.022 (NV).

**Aplicabilidad NISAR y Santiago.** **No aplica a NISAR** (óptico). En el Río Dulce, los tramos anchos admiten píxeles de 20 m; los brazos angostos y bancos de arena someros quedan afectados por el fondo y la orilla.

**Dato para validar.** Turbidímetro en campañas simultáneas a pasadas, con distintos caudales. Para sólidos en mg/L, muestras filtradas y una relación local T/SPM.

---

## F16. Humo y calidad del aire

**Ecuación original.** C_obs = a_s + b·C_CAMS + βᵀw + ε (P10).

**Problemas.** La forma es una corrección estadística razonable. El texto dice "después de convertir correctamente el producto" sin dar la conversión: CAMS entrega `pm2p5` como concentración másica en kg/m³.

**Ecuación corregida**

$$C_{\mathrm{CAMS}}\,[\mu\mathrm{g\,m^{-3}}]=10^{9}\cdot\mathrm{pm2p5}\,[\mathrm{kg\,m^{-3}}]$$

**Unidades y dominio.** µg/m³; b adimensional; a_s en µg/m³.

**Fuente primaria.** [CAMS](https://atmosphere.copernicus.eu/configuration-daily-global-analyses-and-forecasts) (I). La unidad del parámetro `pm2p5` debe confirmarse en el catálogo de parámetros de ECMWF (NV).

**Aplicabilidad NISAR y Santiago.** No usa radar. Sin monitores de referencia en la ciudad no hay forma de estimar a_s ni b.

**Dato para validar.** Monitores de PM2,5 de referencia con varios episodios de humo.

---

## F17. Deformación del terreno

**Ecuación original**

$$\Delta\phi_{\mathrm{corr}}=-\frac{4\pi}{\lambda}\Delta R,\qquad \Delta R=-\frac{\lambda}{4\pi}\Delta\phi_{\mathrm{corr}}$$

con el interferograma definido como s₂s₁* y ΔR positivo al alejarse.

**Problemas**

1. **Signo.** Con la definición del insumo (s₂s₁*, fase de propagación −4πR/λ), las ecuaciones son internamente coherentes. Pero NISAR GUNW no usa esa definición: el producto nativo toma como referencia la fecha anterior y su fase desenrollada es **positiva cuando la distancia satélite-suelo aumenta**. Aplicar la ecuación original a GUNW invierte el signo: un hundimiento aparecería como levantamiento. ARIA-tools invierte fechas y signos de NISAR para homogeneizarlo con Sentinel-1, lo que confirma la diferencia de convención.
2. **Correcciones.** GUNW incluye la pantalla de fase ionosférica, pero no la aplica por defecto. En banda L la ionosfera es el error dominante a escala de decenas de kilómetros.
3. Falta la proyección aproximada a vertical.

**Ecuación corregida (convención nativa de GUNW)**

$$\Delta\phi_{\mathrm{corr}}=\Delta\phi_{\mathrm{unw}}-\phi_{\mathrm{iono}}-\phi_{\mathrm{tropo}}-\phi_{\mathrm{mareas}}-\phi_{\mathrm{ref}}$$

$$\Delta R=+\frac{\lambda}{4\pi}\,\Delta\phi_{\mathrm{corr}}\quad(\Delta R>0:\ \text{alejamiento}),\qquad d_{\mathrm{LOS}}=-\frac{\lambda}{4\pi}\,\Delta\phi_{\mathrm{corr}}\quad(d_{\mathrm{LOS}}>0:\ \text{acercamiento})$$

$$\lambda=\frac{c}{f_0},\qquad d_v\approx\frac{d_{\mathrm{LOS}}}{\cos\theta_{\mathrm{inc}}}\quad(\text{solo si el movimiento horizontal es despreciable})$$

Con f₀ = 1,257 GHz, λ ≈ 0,2385 m y una franja (2π) equivale a λ/2 ≈ 11,9 cm de cambio de distancia. φ_ref es la fase en un punto de referencia estable. Antes de procesar, el signo debe confirmarse contra la descripción del dataset en el gránulo y contra un punto GNSS.

Coherencia interferométrica (indicador de calidad y también de cambio de superficie):

$$|\rho|=\frac{\left|\mathrm E\left[s_1s_2^\ast\right]\right|}{\sqrt{\mathrm E\left[|s_1|^2\right]\mathrm E\left[|s_2|^2\right]}}\in[0,1]$$

Modelo de velocidad (P11): d(t) = d₀ + vt + ε, sin cambios.

**Unidades y dominio.** Fase en rad; λ y ΔR en m; d en mm; v en mm/año. Solo componente LOS.

**Supuestos.** Desenrollado correcto dentro de cada componente conexa. Coherencia suficiente: en cultivos, 12 días en banda L suelen conservarla mejor que en banda C, pero el laboreo la destruye.

**Fuentes primarias.** [ASF, GUNW](https://nisar-docs.asf.alaska.edu/gunw/) (V: fase a 80 m, solo copolar y frecuencia A, pantalla ionosférica incluida pero no aplicada). [ARIA-tools, convención de fecha y fase](https://github.com/aria-tools/ARIA-tools/blob/dev/README.md) (V). [MintPy FAQ, convención de signo](https://github.com/insarlab/MintPy/blob/main/docs/FAQs.md) (V). [ISCE2, discusión 523](https://github.com/isce-framework/isce2/discussions/523) (V).

**Aplicabilidad NISAR y Santiago.** Aplica con GUNW. En la llanura, la señal esperable es pequeña (subsidencia por extracción de agua o asentamiento de obras), del orden de milímetros a centímetros por año, comparable al error ionosférico si no se corrige.

**Dato para validar.** Estaciones GNSS permanentes o nivelación de precisión en el área.

---

## Fórmulas generales y formulaciones propuestas

| Ítem | Fórmula | Estado | Observación |
|---|---|---|---|
| G1 | Media areal x̄_A y fracción válida c_A | Correcta | Para γ⁰, siempre en lineal (F01) |
| G2 | Combinación por mínima varianza w = Σ⁻¹1/(1ᵀΣ⁻¹1) | Correcta | Estimador lineal insesgado de mínima varianza; solo para estimaciones de la misma magnitud |
| G3 | Var(y) ≈ JΣJᵀ | Correcta | Para y vectorial da la covarianza completa |
| G4 | F̂_{t,h}(y) = Pr(Y_{t+h} ≤ y ∣ 𝓘_t) | Correcta | |
| G5 | dS/dt = P_A − ET_A + Q_e − Q_s − W | Correcta | P_A y ET_A deben ser volumen por tiempo: tasa (m/s) × área (m²) |
| G6 | MAE, RMSE, sesgo, ubRMSE | Correctas | ubRMSE² = RMSE² − sesgo² |
| G7 | Brier, IoU, CRPS, Skill | Correctas | Skill solo con L_ref > 0 |
| P1 | Logística de estrés (F03) | Necesita datos | |
| P2 | W_t (F04) | Corregida | Ver F04 |
| P3 | Recuperación exponencial (F08) | Necesita datos | Hipótesis, no ley |
| P4 | Softmax (F09) | Correcta | |
| P5 | t_inicio (F10) | Correcta | |
| P6 | I_v (F10) | Correcta | |
| P7 | Regresión de rendimiento (F10) | Necesita datos | |
| P8 | Residual r_t (F12) | Necesita datos | |
| P9 | log ECe (F13) | Necesita datos | Retransformación agregada en F13 |
| P10 | Corrección PM2,5 (F16) | Corregida (unidades) | Ver F16 |
| P11 | d(t) = d₀ + vt + ε (F17) | Correcta | El signo de d hereda la corrección de F17 |
| P12 | Persistencia ŷ = y_t | Correcta | |
| P13 | Climatología ŷ = μ_{d(t+h)} | Correcta | |
| P14 | Persistencia de anomalía | Correcta | |
| P15 | ARX directo por horizonte | Correcta | |
| P16 | Ajuste regularizado L2 | Correcta | |
| P17 | Entropía cruzada | Correcta | |
| P18 | Pérdida de cuantiles ρ_τ(e) = e[τ − 1(e < 0)] | Correcta | |
| P19 | Transición de estado s_{t+1} = f(·) + η | Correcta | |
| P20 | Operador de observación z = h(s) + ν | Correcta | Para F04 → F05, h debe mapear humedad del perfil a la capa de 0 a 5 cm |
| P21 | Probabilidad por conjunto | Correcta | |

## Fórmulas faltantes

Todas se han escrito completas en la sección indicada. Las que no tienen lugar natural en una ficha están al final de esta sección.

| N.º | Fórmula | Sección | Para qué hace falta |
|---|---|---|---|
| 1 | Media lineal de γ⁰ y ΔB sobre medias | F01 | Cambio por parcela sin sesgo |
| 2 | Sesgo del promedio en dB | F01 | Cuantificar el error de promediar en dB |
| 3 | ENL | F01 | Ruido de speckle efectivo |
| 4 | Prueba F del cociente y Var(ΔB) | F01 | Distinguir cambio de speckle |
| 5 | Normalización de incidencia | F01 | Comparar trayectorias |
| 6 | Hargreaves-Samani y auxiliares FAO-56 | F02 | ET₀ con los datos disponibles |
| 7 | Estimador de Thom | F02 | SPI reproducible |
| 8 | Reflectancia S2 y Landsat desde DN | F03 | Cualquier índice óptico |
| 9 | RVI cuadripolar, RVI dual, cociente cruzado | F03 | Vegetación con radar |
| 10 | σ⁰ = γ⁰ · rtcGammaToSigmaFactor | F04 | Modelos calibrados en σ⁰ |
| 11 | Término de suelo del WCM e inversión | F04 | Humedad volumétrica |
| 12 | Aproximación alfa | F04 | Humedad con series NISAR |
| 13 | Topp | F04 | Permitividad a humedad |
| 14 | Multiescala SME2 | F04 | Comparar con el producto oficial |
| 15 | Dubois y Oh | F04 | Solo con datos cuadripolares |
| 16 | K_s completo y p ajustado | F05 | Balance FAO-56 cerrado |
| 17 | Umbrales radar de agua | F06 | Agua con nubes |
| 18 | FRE a biomasa | F07 | Combustible consumido |
| 19 | dNBR × 1000, RdNBR, RBR, ΔB_HV | F08 | Severidad comparable |
| 20 | Estimador de área de Olofsson y CV temporal | F09 | Hectáreas con error |
| 21 | Erosividad EI₃₀ | F12 | Factor R de RUSLE |
| 22 | Retransformación de Duan | F13 | ECe sin sesgo |
| 23 | Esquema rojo/NIR de turbidez y máscara | F15 | Turbidez en todo el rango |
| 24 | Corrección de fase, signo GUNW, coherencia | F17 | Deformación con NISAR |

Conversiones dB y lineal, usadas en todas las fichas radar:

$$x_{\mathrm{dB}}=10\log_{10}x,\qquad x=10^{x_{\mathrm{dB}}/10},\qquad A_{\mathrm{dB}}=20\log_{10}|s|\ \ (\text{amplitud}),\qquad I=|s|^2$$

Un valor complejo de una SLC (RSLC o GSLC) es amplitud compleja s; su potencia es |s|², no la parte real ni |s|. Una diagonal de GCOV ya es potencia.

Remuestreo de máscaras y clases: vecino más cercano o regla de prioridad, nunca interpolación bilineal.

## Coincidencia con el código

Revisión de lectura sobre `termalwave/`, `config/` y la capa de presentación en `web/src/data/`. Implementación auditable en `termalwave/science/` (F01, F03–F04, F06–F08, F16–F17) con tests; SPI/SPEI/ET₀ FAO-56, BFAST, RUSLE y capas derivadas en UI siguen pendientes. La cadena PNG radar delega radiometría F01 en `termalwave.science.radar`.

| Ubicación | Qué hace | Ecuación esperada | Coincide |
|---|---|---|---|
| `config/santiago.toml:28-34` | Prioriza GCOV `HHHH`, con fallback RSLC | F01 γ⁰ lineal geocodificado | Parcial. Preferencia correcta; falta selección HV y máscara de producto |
| `termalwave/science/radar.py` | Potencia lineal, media areal, ΔB, γ⁰→σ⁰ | F01/F04 | Sí (biblioteca) |
| `termalwave/science/indices.py` | NDVI/NDMI/MNDWI/NBR; MNDWI etiquetado como agua óptica | F03/F06/F08 | Sí (biblioteca; sin capa óptica en pipeline) |
| `termalwave/science/vegetation.py` | RVI dual sin recorte a [0, 1] | F03 | Sí (biblioteca) |
| `termalwave/process/pipeline.py` | `sample_to_power` + `power_to_db` + `db_fixed` | F01 B = 10 log₁₀ γ⁰, escala fija | Sí para overlay; ΔB aún no expuesto en sidecar |
| `termalwave/process/pipeline.py:85` | Transparencia donde el valor es ≤ 0 | Máscara del producto (`mask`) | Parcial. Vale para potencia lineal; si la entrada estuviera en dB (negativa), ocultaría toda la imagen |
| `termalwave/process/pipeline.py:213-216` | Sustituye los límites del archivo por los del AOI sin remuestrear | Recorte o reproyección con la geometría real | No. Ubica píxeles en coordenadas falsas |
| `termalwave/process/timeline.py:13-54` | Genera campos sintéticos (gaussianas, senos, chispas aleatorias) por capa y año | F01, F04, F07/F08 según capa | No aplica: no hay ecuación física. Las líneas 50-53 normalizan cada cuadro a [0, 1] por separado, así que el cambio entre años no tiene unidad |
| `termalwave/merge.py:28-56` y `config/apis.toml:35-37` | Deduplica focos a 1 km y 12 h, conservando uno | F07 necesita todas las observaciones del foco para integrar FRE | No para FRE. La fórmula de haversine (`merge.py:19-25`, R = 6371 km) es correcta |
| `termalwave/merge.py:103-133` e `termalwave/process/ingest.py:67-78` | Elige la escena óptica menos nubosa a ±16 días de dos fechas fijas (15 de junio del primer y último año), con nubosidad de escena ≤ 40 % | F03/F08 requieren máscara de nubes por píxel y fechas emparejadas con NISAR | No. Las fechas objetivo no son las de NISAR (las líneas 139-150 calculan los tiempos radar pero no los usan) |
| `termalwave/merge.py:136-151` | Conserva un gránulo radar por día calendario, priorizando el validado | F01 compara dentro de la misma trayectoria | Parcial. Dos trayectorias distintas del mismo día colapsan en una |
| `termalwave/merge.py:59-100` | Meteorología diaria con Tmax, Tmin y P | F02 con FAO-56 necesita R_n, u₂, e_a | No alcanza para FAO-56. Alcanza para Hargreaves-Samani y para SPI |
| `web/src/data/layer-defaults.ts:16-17` | Radar en dB con rango [−20, −4] | B en dB | No coincide con el pipeline, que no produce dB. El rango es plausible para HH en banda L, no para HV (que suele estar más bajo) |
| `web/src/data/layer-defaults.ts:25` | Nota: valores altos indican superficies rugosas o con más humedad | F01: el cambio radar no identifica su causa | Parcial. La nota de `web/src/context/layers.json:3` es la correcta y la reemplaza cuando existe |
| `web/src/data/layer-defaults.ts:28-29,38` | Suelo en % con rango [20, 50], "estimado a partir del radar" | F04 exige inversión calibrada para dar humedad volumétrica | No. No hay inversión; el cuadro es sintético. Si se mostrara W_t, la unidad correcta es adimensional [0, 1] |
| `web/src/data/layer-defaults.ts:53-54,62` | Incendios en hectáreas, "detectadas por cambio de señal" | F08 (área quemada con dNBR o ΔB_HV) | No. Los cuadros son una máscara aleatoria; no hay detección de cambio ni área |

Las mismas observaciones de georreferencia y de reemplazo de datos sintéticos figuran en la investigación original. Esta tabla solo agrega la vinculación con cada ecuación y la ubicación exacta.
