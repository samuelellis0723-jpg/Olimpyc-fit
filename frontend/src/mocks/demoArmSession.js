// Rutina visual tomada del Stitch. Es una simulación local, no una prescripción aprobada.
const curlImage = 'https://lh3.googleusercontent.com/aida/ALJJyrBtroK0ja1NhVfF7WKSStWMs6KSJcXNo9uTT79gqceE8IK8NN89EsA8K2pijtlj6wiF4iiLzrQEritT8eBgIyutm556p2j1FfQv2sA4v3vSS_ghCEbeBC2E2G48nWuJTP2RHbWXH0Uj1JNJl1UB6u64PNo1_ndwtOBmeR2IotDIbk-4OMU3wD6Zj5c4ID0-H28MdIA2W_y0p7fIdTtyqZ6aPyWZr';
const dumbbellCurlImage = '/arm-curl-dumbbell.png';
const hammerCurlImage = '/arm-curl-hammer.png';
const tricepsRopeImage = '/triceps-rope-extension.png';
const tricepsBandImage = '/triceps-band-extension.png';
const bandImage = 'https://lh3.googleusercontent.com/aida/ALJJyrCOU5KjEP12lpG9WgyBAMhYyQRvH7XA4cn1CxDIMt8TAd_bZQFcZglIwW5stZGwki3NpjukmKwjIrMxtPU34Fi1pXrUrxQNLZTIK1MAsb94B0DK_hQ0hHdolE2MBeLHV8AcxUxBsmcNkS7qmhslfNhL6d89U6YZ67YN-FYCnAFsxoViJQ2ycV189TnMTCx7gc5q74RmEs_WSyGozcuu5s3yGo2o1lw6A1O-gDQcrYonzA';

export const DEMO_ARM_SESSION = Object.freeze([
  Object.freeze({ itemId: 'DEMO-ARM-1', exerciseId: 'DEMO-ARM-1', code: '01', name: 'Curl de bíceps con mancuernas', group: 'Bíceps', order: 1, seriesCount: 2, restSeconds: 60, target: { cantidad: '8–12', unidad: 'repeticiones' }, explanation: 'Flexiona los codos para acercar las mancuernas a los hombros y vuelve lentamente a la posición inicial.', image: dumbbellCurlImage }),
  Object.freeze({ itemId: 'DEMO-ARM-2', exerciseId: 'DEMO-ARM-2', code: '02', name: 'Curl martillo con mancuernas', group: 'Bíceps y antebrazo', order: 2, seriesCount: 2, restSeconds: 60, target: { cantidad: '8–12', unidad: 'repeticiones' }, explanation: 'Mantén las palmas enfrentadas mientras flexionas y extiendes los codos de forma controlada.', image: hammerCurlImage }),
  Object.freeze({ itemId: 'DEMO-ARM-3', exerciseId: 'DEMO-ARM-3', code: '03', name: 'Extensión de tríceps en polea con cuerda', group: 'Tríceps', order: 3, seriesCount: 2, restSeconds: 60, target: { cantidad: '8–12', unidad: 'repeticiones' }, explanation: 'Extiende los codos para llevar la cuerda hacia abajo y regresa lentamente.', image: tricepsRopeImage }),
  Object.freeze({ itemId: 'DEMO-ARM-4', exerciseId: 'DEMO-ARM-4', code: '04', name: 'Extensión de tríceps con banda elástica', group: 'Tríceps', order: 4, seriesCount: 2, restSeconds: 60, target: { cantidad: '8–12', unidad: 'repeticiones' }, explanation: 'Extiende los codos contra la resistencia de la banda y regresa con control.', image: tricepsBandImage }),
]);
