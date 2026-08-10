import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const platformRoot = process.env.SGP_PLATFORM_ROOT
  ? path.resolve(process.env.SGP_PLATFORM_ROOT)
  : path.resolve(repoRoot, "../SGP-Platform");
const typescriptPath = path.join(platformRoot, "node_modules/typescript/lib/typescript.js");

if (!fs.existsSync(typescriptPath)) {
  throw new Error(`TypeScript is unavailable at ${typescriptPath}. Run npm install in SGP-Platform or set SGP_PLATFORM_ROOT.`);
}

const ts = await import(typescriptPath);
const locales = ["en", "pt", "fr", "es", "ru", "zh", "ar"];
const sourceFiles = [
  "src/i18n.tsx",
  "src/i18n-community-workspace.ts",
  "src/i18n-glossary.ts",
  "src/i18n-interface-completion.ts",
  "src/i18n-ui-completion.ts",
  "src/api-i18n.ts",
  "src/lib/ai/starterIdeas.ts"
].map((relativePath) => path.join(platformRoot, relativePath));

const catalog = new Map();
const conflicts = [];

function staticText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function addRow(row, source) {
  if (row.length !== locales.length || row.some((value) => !value.trim())) return;
  const [english] = row;
  const existing = catalog.get(english);
  if (existing && existing.some((value, index) => value !== row[index])) {
    conflicts.push({ english, source });
    return;
  }
  catalog.set(english, row);
}

function visit(node, source) {
  if (ts.isArrayLiteralExpression(node) && node.elements.length === locales.length) {
    const row = node.elements.map(staticText);
    if (row.every((value) => typeof value === "string")) addRow(row, source);
  }
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "idea" &&
    node.arguments.length === locales.length
  ) {
    const row = node.arguments.map(staticText);
    if (row.every((value) => typeof value === "string")) addRow(row, source);
  }
  ts.forEachChild(node, (child) => visit(child, source));
}

for (const sourceFile of sourceFiles) {
  if (!fs.existsSync(sourceFile)) throw new Error(`Missing translation source: ${sourceFile}`);
  const source = fs.readFileSync(sourceFile, "utf8");
  const parsed = ts.createSourceFile(sourceFile, source, ts.ScriptTarget.Latest, true);
  visit(parsed, path.relative(platformRoot, sourceFile));
}

const additions = [
  ["Starter questions", "Perguntas iniciais", "Questions de départ", "Preguntas iniciales", "Вопросы для начала", "入门问题", "أسئلة للبدء"],
  ["Suggested next questions", "Próximas perguntas sugeridas", "Questions suivantes suggérées", "Siguientes preguntas sugeridas", "Предлагаемые следующие вопросы", "建议的后续问题", "أسئلة متابعة مقترحة"],
  ["Generating follow-up questions...", "Gerando perguntas de acompanhamento...", "Génération des questions de suivi...", "Generando preguntas de seguimiento...", "Формирование дополнительных вопросов...", "正在生成后续问题...", "جارٍ إنشاء أسئلة متابعة..."],
  ["Scoring", "Pontuando", "Évaluation de", "Puntuando", "Оценка", "正在评估", "جارٍ تقييم"],
  ["Loading document relevance...", "Carregando a relevância dos documentos...", "Chargement de la pertinence des documents...", "Cargando la relevancia de los documentos...", "Загрузка релевантности документов...", "正在加载文档相关性...", "جارٍ تحميل مدى صلة الوثائق..."],
  ["Selected document", "Documento selecionado", "Document sélectionné", "Documento seleccionado", "Выбранный документ", "所选文档", "الوثيقة المحددة"],
  ["Top matching documents", "Documentos mais relevantes", "Documents les plus pertinents", "Documentos más relevantes", "Наиболее подходящие документы", "最匹配的文档", "الوثائق الأكثر تطابقاً"],
  ["Untitled document", "Documento sem título", "Document sans titre", "Documento sin título", "Документ без названия", "无标题文档", "وثيقة بلا عنوان"],
  ["Document-level relevance", "Relevância por documento", "Pertinence au niveau du document", "Relevancia por documento", "Релевантность на уровне документа", "文档级相关性", "مدى الصلة على مستوى الوثيقة"],
  ["No documents are available for this corpus selection.", "Nenhum documento está disponível para esta seleção de corpus.", "Aucun document n’est disponible pour cette sélection de corpus.", "No hay documentos disponibles para esta selección del corpus.", "Для выбранного корпуса нет доступных документов.", "此语料库选择没有可用文档。", "لا توجد وثائق متاحة لاختيار مجموعة المحتوى هذا."],
  ["Corpus map unavailable", "Mapa do corpus indisponível", "Carte du corpus indisponible", "Mapa del corpus no disponible", "Карта корпуса недоступна", "语料库地图不可用", "خريطة مجموعة المحتوى غير متاحة"],
  ["Corpus map could not load. Answers and sources still work.", "Não foi possível carregar o mapa do corpus. As respostas e fontes continuam funcionando.", "La carte du corpus n’a pas pu être chargée. Les réponses et les sources restent disponibles.", "No se pudo cargar el mapa del corpus. Las respuestas y las fuentes siguen funcionando.", "Не удалось загрузить карту корпуса. Ответы и источники по-прежнему доступны.", "无法加载语料库地图。答案和来源仍可使用。", "تعذر تحميل خريطة مجموعة المحتوى. لا تزال الإجابات والمصادر تعمل."],
  ["document", "documento", "document", "documento", "документ", "文档", "وثيقة"],
  ["documents", "documentos", "documents", "documentos", "документов", "文档", "وثائق"],
  ["No references returned yet.", "Nenhuma referência retornada até o momento.", "Aucune référence n’a encore été renvoyée.", "Aún no se han devuelto referencias.", "Ссылки пока не получены.", "尚未返回参考资料。", "لم تُسترجع أي مراجع بعد."],
  ["Checking", "Verificando", "Vérification de", "Comprobando", "Проверка", "正在检查", "جارٍ التحقق من"],
  ["Ready", "Pronto", "Prêt", "Listo", "Готово", "就绪", "جاهز"],
  ["Corpus unavailable", "Corpus indisponível", "Corpus indisponible", "Corpus no disponible", "Корпус недоступен", "语料库不可用", "مجموعة المحتوى غير متاحة"],
  ["Backend unavailable", "Backend indisponível", "Service dorsal indisponible", "Backend no disponible", "Серверная часть недоступна", "后端不可用", "الخدمة الخلفية غير متاحة"],
  ["Streaming", "Transmitindo", "Diffusion", "Transmitiendo", "Потоковая передача", "正在传输", "بث مباشر"],
  ["Waiting for references...", "Aguardando referências...", "En attente des références...", "Esperando referencias...", "Ожидание ссылок...", "正在等待参考资料...", "في انتظار المراجع..."],
  ["Error", "Erro", "Erreur", "Error", "Ошибка", "错误", "خطأ"],
  [
    "Technical demos",
    "Demonstrações técnicas",
    "Démonstrations techniques",
    "Demostraciones técnicas",
    "Технические демонстрации",
    "技术演示",
    "العروض التقنية"
  ],
  [
    "Available tools",
    "Ferramentas disponíveis",
    "Outils disponibles",
    "Herramientas disponibles",
    "Доступные инструменты",
    "可用工具",
    "الأدوات المتاحة"
  ],
  [
    "This technical demo explores feature sets, interface patterns, database opportunities, and knowledge workflows for a future GEF Small Grants Programme Knowledge and Learning Platform.",
    "Esta demonstração técnica explora funcionalidades, padrões de interface, oportunidades de banco de dados e fluxos de conhecimento para uma futura Plataforma de Conhecimento e Aprendizagem do Programa de Pequenas Subvenções do GEF.",
    "Cette démonstration technique explore les fonctionnalités, les modèles d’interface, les possibilités offertes par les bases de données et les flux de connaissances d’une future Plateforme de connaissances et d’apprentissage du Programme de microfinancements du FEM.",
    "Esta demostración técnica explora funcionalidades, patrones de interfaz, oportunidades de bases de datos y flujos de conocimiento para una futura Plataforma de Conocimiento y Aprendizaje del Programa de Pequeñas Donaciones del FMAM.",
    "Эта техническая демонстрация представляет функции, интерфейсные решения, возможности баз данных и процессы управления знаниями для будущей Платформы знаний и обучения Программы малых грантов ГЭФ.",
    "本技术演示探索未来 GEF 小额赠款计划知识与学习平台的功能、界面模式、数据库机会和知识工作流程。",
    "يستعرض هذا العرض التقني مجموعات الميزات وأنماط الواجهات وفرص قواعد البيانات ومسارات عمل المعرفة لمنصة مستقبلية للمعرفة والتعلّم تابعة لبرنامج المنح الصغيرة لمرفق البيئة العالمية."
  ],
  [
    "Ask the knowledge base",
    "Consultar a base de conhecimento",
    "Interroger la base de connaissances",
    "Consultar la base de conocimientos",
    "Задать вопрос базе знаний",
    "查询知识库",
    "اسأل قاعدة المعرفة"
  ],
  [
    "Query SGP publications, project records, and annual monitoring material with cited source cards.",
    "Consulte publicações do SGP, registros de projetos e materiais de monitoramento anual com cartões de fontes citadas.",
    "Interrogez les publications du SGP, les dossiers de projets et les documents de suivi annuel avec des fiches de sources citées.",
    "Consulte publicaciones del SGP, registros de proyectos y materiales de seguimiento anual con fichas de fuentes citadas.",
    "Ищите по публикациям SGP, записям проектов и материалам ежегодного мониторинга с карточками цитируемых источников.",
    "查询 SGP 出版物、项目记录和年度监测材料，并查看引用来源卡片。",
    "ابحث في منشورات برنامج المنح الصغيرة وسجلات المشاريع ومواد الرصد السنوي مع بطاقات للمصادر المستشهد بها."
  ],
  [
    "Explore the grant portfolio",
    "Explorar o portfólio de subvenções",
    "Explorer le portefeuille de subventions",
    "Explorar la cartera de subvenciones",
    "Изучить портфель грантов",
    "探索赠款组合",
    "استكشاف محفظة المنح"
  ],
  [
    "Filter grants by geography, theme, finance, and partner dimensions on the atlas.",
    "Filtre as subvenções por geografia, tema, financiamento e dimensões de parceiros no atlas.",
    "Filtrez les subventions dans l’atlas par zone géographique, thème, financement et type de partenaire.",
    "Filtre las subvenciones en el atlas por geografía, tema, financiación y tipo de socio.",
    "Фильтруйте гранты в атласе по географии, тематике, финансированию и типам партнёров.",
    "在地图集中按地理位置、主题、资金和合作伙伴维度筛选赠款。",
    "صفِّ المنح في الأطلس حسب الموقع الجغرافي والموضوع والتمويل وأبعاد الشركاء."
  ],
  [
    "Inspect scraped site content",
    "Inspecionar o conteúdo coletado do site",
    "Examiner le contenu collecté du site",
    "Examinar el contenido recopilado del sitio",
    "Просмотреть собранный контент сайта",
    "检查抓取的网站内容",
    "فحص محتوى الموقع الذي جُمِع آلياً"
  ],
  [
    "Browse country, area, article, media, and document records from the SGP archive.",
    "Explore registros de países, áreas, artigos, mídias e documentos do arquivo do SGP.",
    "Parcourez les fiches de pays, domaines, articles, médias et documents des archives du SGP.",
    "Explore registros de países, áreas, artículos, medios y documentos del archivo del SGP.",
    "Просматривайте записи о странах, направлениях, статьях, медиа и документах из архива SGP.",
    "浏览 SGP 档案中的国家、领域、文章、媒体和文档记录。",
    "تصفح سجلات البلدان والمجالات والمقالات والوسائط والوثائق من أرشيف برنامج المنح الصغيرة."
  ],
  [
    "Ask the SGP knowledge base",
    "Pergunte à base de conhecimento do SGP",
    "Interroger la base de connaissances du SGP",
    "Pregunte a la base de conocimientos del SGP",
    "Задать вопрос базе знаний SGP",
    "询问 SGP 知识库",
    "اسأل قاعدة معارف برنامج المنح الصغيرة"
  ],
  [
    "Answers are generated from SGP publication excerpts covering SGP-supported grants, annual monitoring reports, and country programme materials.",
    "As respostas são geradas a partir de trechos de publicações do SGP sobre subvenções apoiadas pelo programa, relatórios anuais de monitoramento e materiais de programas nacionais.",
    "Les réponses sont générées à partir d’extraits de publications du SGP portant sur les subventions soutenues, les rapports annuels de suivi et les documents des programmes nationaux.",
    "Las respuestas se generan a partir de extractos de publicaciones del SGP sobre subvenciones apoyadas, informes anuales de seguimiento y materiales de programas nacionales.",
    "Ответы формируются на основе фрагментов публикаций SGP о поддержанных грантах, ежегодных отчётах по мониторингу и материалах страновых программ.",
    "答案根据 SGP 出版物摘录生成，涵盖 SGP 支持的赠款、年度监测报告和国家方案材料。",
    "تُنشأ الإجابات من مقتطفات منشورات برنامج المنح الصغيرة التي تغطي المنح المدعومة وتقارير الرصد السنوية ومواد البرامج القطرية."
  ],
  [
    "How have SGP-supported grants helped communities address coastal erosion?",
    "Como as subvenções apoiadas pelo SGP ajudaram as comunidades a enfrentar a erosão costeira?",
    "Comment les subventions soutenues par le SGP ont-elles aidé les communautés à lutter contre l’érosion côtière ?",
    "¿Cómo han ayudado las subvenciones apoyadas por el SGP a las comunidades a afrontar la erosión costera?",
    "Как поддержанные SGP гранты помогли местным сообществам бороться с береговой эрозией?",
    "SGP 支持的赠款如何帮助社区应对海岸侵蚀？",
    "كيف ساعدت المنح المدعومة من برنامج المنح الصغيرة المجتمعات على التصدي لتآكل السواحل؟"
  ],
  [
    "Ask a question to stream an answer.",
    "Faça uma pergunta para receber uma resposta em tempo real.",
    "Posez une question pour recevoir une réponse en continu.",
    "Haga una pregunta para recibir una respuesta en tiempo real.",
    "Задайте вопрос, чтобы получить потоковый ответ.",
    "提出问题以实时生成答案。",
    "اطرح سؤالاً لتلقي الإجابة مباشرة."
  ],
  [
    "References will appear when the answer stream returns documents.",
    "As referências aparecerão quando a resposta retornar documentos.",
    "Les références apparaîtront lorsque la réponse renverra des documents.",
    "Las referencias aparecerán cuando la respuesta devuelva documentos.",
    "Ссылки появятся, когда поток ответа вернёт документы.",
    "当回答流返回文档时，将显示参考资料。",
    "ستظهر المراجع عندما يعيد تدفق الإجابة الوثائق."
  ],
  [
    "Open the archive tree, drill into a record, then select a final content element such as body text, a section, contact, image, document, video, or link.",
    "Abra a árvore do arquivo, navegue até um registro e selecione um elemento final, como texto, seção, contato, imagem, documento, vídeo ou link.",
    "Ouvrez l’arborescence des archives, explorez une fiche, puis sélectionnez un élément final tel qu’un texte, une section, un contact, une image, un document, une vidéo ou un lien.",
    "Abra el árbol del archivo, explore un registro y seleccione un elemento final, como texto, sección, contacto, imagen, documento, vídeo o enlace.",
    "Откройте дерево архива, перейдите к записи и выберите конечный элемент: текст, раздел, контакт, изображение, документ, видео или ссылку.",
    "打开档案树，深入查看记录，然后选择正文、章节、联系人、图像、文档、视频或链接等最终内容元素。",
    "افتح شجرة الأرشيف وانتقل إلى سجل ثم اختر عنصراً نهائياً مثل النص أو القسم أو جهة الاتصال أو الصورة أو الوثيقة أو الفيديو أو الرابط."
  ],
  [
    "Search title, URL, type, status…",
    "Pesquisar título, URL, tipo, status…",
    "Rechercher par titre, URL, type ou statut…",
    "Buscar por título, URL, tipo o estado…",
    "Поиск по названию, URL, типу или статусу…",
    "按标题、URL、类型或状态搜索…",
    "البحث حسب العنوان أو الرابط أو النوع أو الحالة…"
  ]
];

const demoUiAdditions = [
  ["SGP KLP", "SGP KLP", "SGP KLP", "SGP KLP", "SGP KLP", "SGP KLP", "SGP KLP"],
  ["GEF Small Grants Programme", "Programa de Pequenas Subvenções do GEF", "Programme de microfinancements du FEM", "Programa de Pequeñas Donaciones del FMAM", "Программа малых грантов ГЭФ", "GEF 小额赠款计划", "برنامج المنح الصغيرة لمرفق البيئة العالمية"],
  ["GEF Small Grants Programme Knowledge and Learning Platform", "Plataforma de Conhecimento e Aprendizagem do Programa de Pequenas Subvenções do GEF", "Plateforme de connaissances et d’apprentissage du Programme de microfinancements du FEM", "Plataforma de Conocimiento y Aprendizaje del Programa de Pequeñas Donaciones del FMAM", "Платформа знаний и обучения Программы малых грантов ГЭФ", "GEF 小额赠款计划知识与学习平台", "منصة المعرفة والتعلّم لبرنامج المنح الصغيرة لمرفق البيئة العالمية"],
  ["SGP AI", "IA do SGP", "IA du SGP", "IA del SGP", "ИИ SGP", "SGP 人工智能", "الذكاء الاصطناعي لبرنامج المنح الصغيرة"],
  ["SGP Portfolio", "Portfólio do SGP", "Portefeuille du SGP", "Cartera del SGP", "Портфель SGP", "SGP 项目组合", "محفظة برنامج المنح الصغيرة"],
  ["SGP Website Content", "Conteúdo do site do SGP", "Contenu du site du SGP", "Contenido del sitio web del SGP", "Содержимое сайта SGP", "SGP 网站内容", "محتوى موقع برنامج المنح الصغيرة"],
  ["SGP Website Map", "Mapa do site do SGP", "Plan du site du SGP", "Mapa del sitio del SGP", "Карта сайта SGP", "SGP 网站地图", "خريطة موقع برنامج المنح الصغيرة"],
  ["Innovation Library AI", "IA da Biblioteca de Inovação", "IA de la Bibliothèque de l’innovation", "IA de la Biblioteca de Innovación", "ИИ Библиотеки инноваций", "创新资料库人工智能", "الذكاء الاصطناعي لمكتبة الابتكار"],
  ["SGP KLP navigation", "Navegação da KLP do SGP", "Navigation de la KLP du SGP", "Navegación de la KLP del SGP", "Навигация KLP SGP", "SGP KLP 导航", "التنقل في منصة المعرفة والتعلّم"],
  ["Primary", "Principal", "Principale", "Principal", "Основная", "主导航", "رئيسي"],
  ["SGP KLP home", "Página inicial da KLP do SGP", "Accueil de la KLP du SGP", "Inicio de la KLP del SGP", "Главная KLP SGP", "SGP KLP 首页", "الصفحة الرئيسية لمنصة المعرفة والتعلّم"],
  ["Question", "Pergunta", "Question", "Pregunta", "Вопрос", "问题", "السؤال"],
  ["Checking backend...", "Verificando o serviço...", "Vérification du service...", "Comprobando el servicio...", "Проверка серверной службы...", "正在检查后端服务...", "جارٍ التحقق من الخدمة الخلفية..."],
  ["Submit question", "Enviar pergunta", "Envoyer la question", "Enviar pregunta", "Отправить вопрос", "提交问题", "إرسال السؤال"],
  ["Stop", "Parar", "Arrêter", "Detener", "Остановить", "停止", "إيقاف"],
  ["Answer workspace", "Área de respostas", "Espace de réponse", "Área de respuestas", "Область ответа", "回答工作区", "مساحة الإجابة"],
  ["Answer", "Resposta", "Réponse", "Respuesta", "Ответ", "回答", "الإجابة"],
  ["Clear", "Limpar", "Effacer", "Limpiar", "Очистить", "清除", "مسح"],
  ["SGP Archive Browser", "Navegador do arquivo do SGP", "Navigateur des archives du SGP", "Navegador del archivo del SGP", "Обозреватель архива SGP", "SGP 档案浏览器", "متصفح أرشيف برنامج المنح الصغيرة"],
  ["Media Preview", "Pré-visualização de mídia", "Aperçu des médias", "Vista previa multimedia", "Предпросмотр медиа", "媒体预览", "معاينة الوسائط"],
  ["Available Content", "Conteúdo disponível", "Contenu disponible", "Contenido disponible", "Доступные материалы", "可用内容", "المحتوى المتاح"],
  ["Browse country pages, stories, voices, media, links, and metadata from the structured SGP website scrape.", "Explore páginas de países, histórias, vozes, mídias, links e metadados da coleta estruturada do site do SGP.", "Parcourez les pages pays, récits, voix, médias, liens et métadonnées issus de la collecte structurée du site du SGP.", "Explore páginas de países, historias, voces, medios, enlaces y metadatos de la recopilación estructurada del sitio del SGP.", "Просматривайте страницы стран, истории, голоса, медиа, ссылки и метаданные из структурированной выгрузки сайта SGP.", "浏览 SGP 网站结构化采集中的国家页面、故事、声音、媒体、链接和元数据。", "تصفح صفحات البلدان والقصص والأصوات والوسائط والروابط والبيانات الوصفية من النسخة المنظمة لموقع برنامج المنح الصغيرة."],
  ["Areas Of Work", "Áreas de atuação", "Domaines d’intervention", "Áreas de trabajo", "Направления работы", "工作领域", "مجالات العمل"],
  ["Images", "Imagens", "Images", "Imágenes", "Изображения", "图像", "الصور"],
  ["Downloaded Files", "Arquivos baixados", "Fichiers téléchargés", "Archivos descargados", "Загруженные файлы", "已下载文件", "الملفات المنزلة"],
  ["External References", "Referências externas", "Références externes", "Referencias externas", "Внешние ссылки", "外部参考资料", "المراجع الخارجية"],
  ["Publication References", "Referências de publicações", "Références de publications", "Referencias de publicaciones", "Ссылки на публикации", "出版物参考资料", "مراجع المنشورات"],
  ["Newsletters", "Boletins informativos", "Bulletins d’information", "Boletines", "Информационные бюллетени", "新闻简报", "النشرات الإخبارية"],
  ["Group", "Grupo", "Groupe", "Grupo", "Группа", "组", "مجموعة"],
  ["Record", "Registro", "Fiche", "Registro", "Запись", "记录", "سجل"],
  ["unknown", "desconhecido", "inconnu", "desconocido", "неизвестно", "未知", "غير معروف"],
  ["Loading...", "Carregando...", "Chargement...", "Cargando...", "Загрузка...", "正在加载...", "جارٍ التحميل..."],
  ["matching records or loaded content elements", "registros correspondentes ou elementos de conteúdo carregados", "fiches correspondantes ou éléments de contenu chargés", "registros coincidentes o elementos de contenido cargados", "совпадающих записей или загруженных элементов", "条匹配记录或已加载内容元素", "من السجلات المطابقة أو عناصر المحتوى المحملة"],
  ["Showing first 800 matches. Narrow the search to see more.", "Exibindo as primeiras 800 correspondências. Refine a pesquisa para ver mais.", "Affichage des 800 premiers résultats. Affinez la recherche pour en voir davantage.", "Se muestran las primeras 800 coincidencias. Acote la búsqueda para ver más.", "Показаны первые 800 совпадений. Уточните поиск, чтобы увидеть больше.", "显示前 800 个匹配项。缩小搜索范围以查看更多。", "يتم عرض أول 800 نتيجة. ضيّق نطاق البحث لرؤية المزيد."],
  ["No linked items.", "Nenhum item vinculado.", "Aucun élément lié.", "No hay elementos vinculados.", "Нет связанных элементов.", "没有关联项目。", "لا توجد عناصر مرتبطة."],
  ["Loading record details...", "Carregando detalhes do registro...", "Chargement des détails de la fiche...", "Cargando los detalles del registro...", "Загрузка сведений о записи...", "正在加载记录详情...", "جارٍ تحميل تفاصيل السجل..."],
  ["PDF/document asset. Preview is intentionally not embedded.", "Arquivo PDF/documento. A pré-visualização não é incorporada intencionalmente.", "Ressource PDF/document. L’aperçu n’est volontairement pas intégré.", "Recurso PDF/documento. La vista previa no se incorpora intencionalmente.", "PDF/документ. Предпросмотр намеренно не встроен.", "PDF/文档资源。预览未嵌入。", "ملف PDF/وثيقة. لم تُضمَّن المعاينة عمداً."],
  ["Element", "Elemento", "Élément", "Elemento", "Элемент", "元素", "العنصر"],
  ["Record Type", "Tipo de registro", "Type de fiche", "Tipo de registro", "Тип записи", "记录类型", "نوع السجل"],
  ["Route", "Rota", "Route", "Ruta", "Маршрут", "路由", "المسار"],
  ["Source File", "Arquivo de origem", "Fichier source", "Archivo de origen", "Исходный файл", "源文件", "الملف المصدر"],
  ["Path", "Caminho", "Chemin", "Ruta", "Путь", "路径", "المسار"],
  ["Map ID", "ID do mapa", "ID de carte", "ID del mapa", "ID карты", "地图 ID", "معرّف الخريطة"],
  ["Asset Type", "Tipo de ativo", "Type de ressource", "Tipo de recurso", "Тип ресурса", "资源类型", "نوع الأصل"],
  ["Content Type", "Tipo de conteúdo", "Type de contenu", "Tipo de contenido", "Тип содержимого", "内容类型", "نوع المحتوى"],
  ["Reference Count", "Número de referências", "Nombre de références", "Número de referencias", "Число ссылок", "参考资料数量", "عدد المراجع"],
  ["Content", "Conteúdo", "Contenu", "Contenido", "Содержимое", "内容", "المحتوى"],
  ["Related Links", "Links relacionados", "Liens associés", "Enlaces relacionados", "Связанные ссылки", "相关链接", "الروابط ذات الصلة"],
  ["Content Element", "Elemento de conteúdo", "Élément de contenu", "Elemento de contenido", "Элемент содержимого", "内容元素", "عنصر المحتوى"],
  ["Open source URL in browser", "Abrir URL de origem no navegador", "Ouvrir l’URL source dans le navigateur", "Abrir la URL de origen en el navegador", "Открыть исходный URL в браузере", "在浏览器中打开源 URL", "فتح رابط المصدر في المتصفح"],
  ["No source URL", "Sem URL de origem", "Aucune URL source", "Sin URL de origen", "Нет исходного URL", "无源 URL", "لا يوجد رابط مصدر"],
  ["Element Data", "Dados do elemento", "Données de l’élément", "Datos del elemento", "Данные элемента", "元素数据", "بيانات العنصر"],
  ["Node Kind", "Tipo de nó", "Type de nœud", "Tipo de nodo", "Тип узла", "节点类型", "نوع العقدة"],
  ["Template", "Modelo", "Modèle", "Plantilla", "Шаблон", "模板", "القالب"],
  ["Template Family", "Família de modelos", "Famille de modèles", "Familia de plantillas", "Семейство шаблонов", "模板系列", "عائلة القالب"],
  ["URL", "URL", "URL", "URL", "URL", "URL", "الرابط"],
  ["Children Loaded", "Filhos carregados", "Enfants chargés", "Elementos secundarios cargados", "Загружено дочерних элементов", "已加载子项", "العناصر الفرعية المحملة"],
  ["Children Shard", "Fragmento dos filhos", "Fragment des enfants", "Fragmento secundario", "Сегмент дочерних элементов", "子项分片", "جزء العناصر الفرعية"],
  ["Children Ref", "Referência dos filhos", "Référence des enfants", "Referencia secundaria", "Ссылка на дочерние элементы", "子项引用", "مرجع العناصر الفرعية"],
  ["Loaded Children", "Filhos carregados", "Enfants chargés", "Elementos secundarios cargados", "Загруженные дочерние элементы", "已加载子项", "العناصر الفرعية المحملة"],
  ["Children", "Filhos", "Enfants", "Elementos secundarios", "Дочерние элементы", "子项", "العناصر الفرعية"],
  ["Children are stored in tree shard", "Os filhos são armazenados no fragmento de árvore", "Les enfants sont stockés dans le fragment d’arbre", "Los elementos secundarios se almacenan en el fragmento del árbol", "Дочерние элементы хранятся в сегменте дерева", "子项存储在树分片中", "تُخزّن العناصر الفرعية في جزء الشجرة"],
  ["Open this section to load them.", "Abra esta seção para carregá-los.", "Ouvrez cette section pour les charger.", "Abra esta sección para cargarlos.", "Откройте этот раздел, чтобы загрузить их.", "打开此部分以加载它们。", "افتح هذا القسم لتحميلها."],
  ["Tree Section", "Seção da árvore", "Section de l’arbre", "Sección del árbol", "Раздел дерева", "树部分", "قسم الشجرة"],
  ["Tree section", "Seção da árvore", "Section de l’arbre", "Sección del árbol", "Раздел дерева", "树部分", "قسم الشجرة"],
  ["Node JSON", "JSON do nó", "JSON du nœud", "JSON del nodo", "JSON узла", "节点 JSON", "JSON للعقدة"],
  ["content records", "registros de conteúdo", "fiches de contenu", "registros de contenido", "записей содержимого", "条内容记录", "سجلات محتوى"],
  ["mapped records", "registros mapeados", "fiches cartographiées", "registros mapeados", "сопоставленных записей", "条映射记录", "سجلات معيّنة"],
  ["SGP Grant Portfolio", "Portfólio de subvenções do SGP", "Portefeuille de subventions du SGP", "Cartera de subvenciones del SGP", "Портфель грантов SGP", "SGP 赠款组合", "محفظة منح برنامج المنح الصغيرة"],
  ["Interactive SGP portfolio and cofinancing intelligence dashboard", "Painel interativo de inteligência do portfólio e cofinanciamento do SGP", "Tableau de bord interactif du portefeuille et du cofinancement du SGP", "Panel interactivo de inteligencia de cartera y cofinanciación del SGP", "Интерактивная панель портфеля и софинансирования SGP", "SGP 项目组合与共同融资交互式智能仪表板", "لوحة معلومات تفاعلية لمحفظة برنامج المنح الصغيرة والتمويل المشترك"],
  ["SGP AI query interface for the GEF Small Grants Programme Knowledge and Learning Platform.", "Interface de consulta da IA do SGP para a Plataforma de Conhecimento e Aprendizagem do Programa de Pequenas Subvenções do GEF.", "Interface de requête de l’IA du SGP pour la Plateforme de connaissances et d’apprentissage du Programme de microfinancements du FEM.", "Interfaz de consulta de la IA del SGP para la Plataforma de Conocimiento y Aprendizaje del Programa de Pequeñas Donaciones del FMAM.", "Интерфейс запросов ИИ SGP для Платформы знаний и обучения Программы малых грантов ГЭФ.", "GEF 小额赠款计划知识与学习平台的 SGP 人工智能查询界面。", "واجهة الاستعلام بالذكاء الاصطناعي لمنصة المعرفة والتعلّم لبرنامج المنح الصغيرة لمرفق البيئة العالمية."],
  ["SGP KLP technical demo for exploring feature sets, datasets, and knowledge platform opportunities for the GEF Small Grants Programme.", "Demonstração técnica da KLP do SGP para explorar funcionalidades, conjuntos de dados e oportunidades da plataforma de conhecimento do Programa de Pequenas Subvenções do GEF.", "Démonstration technique de la KLP du SGP pour explorer les fonctionnalités, les jeux de données et les possibilités de plateforme de connaissances du Programme de microfinancements du FEM.", "Demostración técnica de la KLP del SGP para explorar funcionalidades, conjuntos de datos y oportunidades de plataforma de conocimiento del Programa de Pequeñas Donaciones del FMAM.", "Техническая демонстрация KLP SGP для изучения функций, наборов данных и возможностей платформы знаний Программы малых грантов ГЭФ.", "用于探索 GEF 小额赠款计划功能、数据集和知识平台机会的 SGP KLP 技术演示。", "عرض تقني لمنصة المعرفة والتعلّم لاستكشاف الميزات ومجموعات البيانات وفرص منصة المعرفة لبرنامج المنح الصغيرة لمرفق البيئة العالمية."],
  ["SGP AI answer interface after a plastic waste query at the top of the page", "Interface de respostas da IA do SGP após uma consulta sobre resíduos plásticos no topo da página", "Interface de réponse de l’IA du SGP après une requête sur les déchets plastiques en haut de la page", "Interfaz de respuesta de la IA del SGP tras una consulta sobre residuos plásticos en la parte superior de la página", "Интерфейс ответа ИИ SGP после запроса о пластиковых отходах в верхней части страницы", "页面顶部塑料废物查询后的 SGP 人工智能回答界面", "واجهة إجابة الذكاء الاصطناعي بعد استعلام عن النفايات البلاستيكية أعلى الصفحة"],
  ["SGP portfolio dashboard in the default state with the Time tab active", "Painel do portfólio do SGP no estado padrão com a guia Tempo ativa", "Tableau de bord du portefeuille du SGP à l’état initial avec l’onglet Temps actif", "Panel de cartera del SGP en el estado predeterminado con la pestaña Tiempo activa", "Панель портфеля SGP в исходном состоянии с активной вкладкой «Время»", "默认状态下已激活“时间”选项卡的 SGP 项目组合仪表板", "لوحة محفظة برنامج المنح الصغيرة في الحالة الافتراضية مع تفعيل علامة تبويب الوقت"],
  ["SGP Website Content redesigned page with the content tree, content category totals, and media preview", "Página redesenhada de conteúdo do site do SGP com árvore de conteúdo, totais por categoria e pré-visualização de mídia", "Page repensée du contenu du site du SGP avec l’arborescence, les totaux par catégorie et l’aperçu des médias", "Página rediseñada del contenido del sitio del SGP con árbol de contenido, totales por categoría y vista previa multimedia", "Обновлённая страница содержимого сайта SGP с деревом, итогами по категориям и предпросмотром медиа", "重新设计的 SGP 网站内容页面，包含内容树、类别总数和媒体预览", "صفحة محتوى موقع برنامج المنح الصغيرة المعاد تصميمها مع شجرة المحتوى وإجماليات الفئات ومعاينة الوسائط"]
];

for (const row of [...additions, ...demoUiAdditions]) addRow(row, "technical-demo additions");

const messages = Object.fromEntries(
  [...catalog.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([english, row]) => [english, Object.fromEntries(locales.map((locale, index) => [locale, row[index]]))])
);

const output = {
  schemaVersion: 1,
  generatedFrom: "SGP-Platform maintained interface catalog plus SGP-KLP-Frontend additions",
  locales: [
    { code: "en", short: "EN", label: "English", nativeLabel: "English", dir: "ltr" },
    { code: "pt", short: "PT", label: "Portuguese", nativeLabel: "Português", dir: "ltr" },
    { code: "fr", short: "FR", label: "French", nativeLabel: "Français", dir: "ltr" },
    { code: "es", short: "ES", label: "Spanish", nativeLabel: "Español", dir: "ltr" },
    { code: "ru", short: "RU", label: "Russian", nativeLabel: "Русский", dir: "ltr" },
    { code: "zh", short: "中文", label: "Chinese", nativeLabel: "中文", dir: "ltr" },
    { code: "ar", short: "ع", label: "Arabic", nativeLabel: "العربية", dir: "rtl" }
  ],
  messages
};

const outputPath = path.join(repoRoot, "assets/i18n-catalog.json");
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({
  output: path.relative(repoRoot, outputPath),
  messages: Object.keys(messages).length,
  conflicts: conflicts.length,
  conflictKeys: [...new Set(conflicts.map(({ english }) => english))].sort()
}, null, 2));
