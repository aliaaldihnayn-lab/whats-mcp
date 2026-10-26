import { Code } from "@/components/Code";
import { Mark, Seal } from "@/components/Mark";

const REPO = "https://github.com/aliaaldihnayn-lab/whats-mcp";
const RAW = "https://raw.githubusercontent.com/aliaaldihnayn-lab/whats-mcp/main";

const DEPLOY_URL =
  "https://vercel.com/new/clone?" +
  new URLSearchParams({
    "repository-url": REPO,
    "root-directory": "web",
    "project-name": "whats-mcp-cloud",
    env: "MCP_SECRET,CRON_SECRET",
    envDescription: "Two long random strings you choose (24+ characters). Meta keys for the official mode can be added later.",
    envLink: `${REPO}/blob/main/web/README.md`,
  }).toString();

export default function Home() {
  return (
    <>
      <div className="wrap">
        <header className="top">
          <a className="mark" href="/">
            <Mark />
            واتساب MCP
          </a>
          <nav aria-label="أقسام الصفحة">
            <a href="#compare">الفرق بين الطريقتين</a>
            <a href="#personal">على جهازك</a>
            <a href="#personal-cloud">على فيرسل</a>
            <a href="#official">الربط الرسمي</a>
            <a href={REPO}>الكود</a>
          </nav>
        </header>

        <main>
          <div className="hero">
            <div>
              <h1>خلّ مساعدك الذكي يقرأ واتساب ويرد عنك</h1>
              <p className="lede">
                اربط واتساب بـ Claude أو Cursor أو أي برنامج يدعم MCP، واطلب منه يلخّص القروبات، يدوّر في محادثاتك، ويرسل الرسائل بعد موافقتك.
              </p>
              <div className="actions">
                <a className="btn solid" href="#personal">ثبّته على جهازك</a>
                <a className="btn ghost" href="#official">اربط رقم الأعمال رسمياً</a>
              </div>
            </div>

            <div className="chat" aria-label="مثال على محادثة مع المساعد">
              <div className="who">محادثتك مع المساعد</div>
              <div className="bubble me">
                وش فاتني في قروب الشغل اليوم؟
                <time>9:41 ص</time>
              </div>
              <div className="tool">list_messages(chat: "Work team")</div>
              <div className="bubble ai">
                ثلاث أشياء تهمك:
                <ul>
                  <li>الاجتماع انتقل للأربعاء 10 الصبح</li>
                  <li>سارة تنتظر ردك على عرض السعر</li>
                  <li>تم رفع ملف الميزانية</li>
                </ul>
                <time>9:41 ص</time>
              </div>
              <div className="bubble me">
                رد على سارة: بأرسله لك قبل الظهر
                <time>9:42 ص</time>
              </div>
              <div className="bubble ai">
                جاهزة الرسالة لسارة. أرسلها؟
                <time>9:42 ص</time>
              </div>
            </div>
          </div>

          <section id="compare" aria-labelledby="compare-h">
            <h2 id="compare-h">طريقتين للربط، اختر اللي يناسبك</h2>
            <p className="intro">
              Meta ما تسمح بقراءة الحسابات الشخصية رسمياً. فإذا تبي محادثاتك الخاصة وقروباتك، الطريقة الوحيدة هي ربط جهازك كـ "جهاز مرتبط" مثل واتساب ويب. وإذا عندك رقم أعمال، تقدر تربطه عبر واجهة Meta الرسمية.
            </p>
            <div className="table-scroll">
              <table className="compare">
                <thead>
                  <tr>
                    <td />
                    <th scope="col">على جهازك</th>
                    <th scope="col">
                      الربط الرسمي
                      <span className="seal">
                        <Seal />
                        Cloud API من Meta
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">الحساب</th>
                    <td>رقمك الشخصي أو أي رقم واتساب</td>
                    <td>رقم واتساب أعمال مسجّل في Meta Business</td>
                  </tr>
                  <tr>
                    <th scope="row">وش يقرأ</th>
                    <td>كل محادثاتك وقروباتك، مع السجل القديم</td>
                    <td>الرسائل اللي توصل بعد الربط، والرسائل اللي ترسلها من تطبيق Business</td>
                  </tr>
                  <tr>
                    <th scope="row">الإرسال</th>
                    <td>أي وقت ولأي أحد</td>
                    <td>رد حر خلال 24 ساعة من آخر رسالة العميل، وبعدها قوالب معتمدة فقط</td>
                  </tr>
                  <tr>
                    <th scope="row">الأدوات</th>
                    <td>45 أداة: قروبات، تصويتات، تعديل وحذف، خصوصية</td>
                    <td>12 أداة: محادثات، بحث، نصوص، وسائط، قوالب، أزرار</td>
                  </tr>
                  <tr>
                    <th scope="row">وين يشتغل</th>
                    <td>على كمبيوترك، أو على فيرسل باتصال عند الطلب</td>
                    <td>على فيرسل، شغال دائماً بدون جهازك</td>
                  </tr>
                  <tr>
                    <th scope="row">التكلفة</th>
                    <td>مجاني</td>
                    <td>استضافة مجانية؛ Meta تحاسب على القوالب، وأول 1,000 رسالة خدمة كل شهر مجانية</td>
                  </tr>
                  <tr>
                    <th scope="row">المخاطرة</th>
                    <td>غير رسمي، فممكن يتقيّد الرقم لو أسأت الاستخدام</td>
                    <td>رسمي ومعتمد من Meta، بشرط تلتزم بسياسات الرسائل</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="personal" aria-labelledby="personal-h">
            <div className="mode">
              <div>
                <h2 id="personal-h">على جهازك</h2>
                <p className="intro">
                  برنامج واحد ينزل في دقيقة، يشتغل بالخلفية ويحفظ الرسائل في ملف على جهازك فقط. ما تحتاج تبرمج ولا تثبّت أي أداة.
                </p>
                <ol className="steps">
                  <li>
                    <strong>ثبّت البرنامج</strong>
                    <p>الصق الأمر المناسب لجهازك في الـ Terminal أو PowerShell.</p>
                  </li>
                  <li>
                    <strong>امسح الرمز من جوالك</strong>
                    <p>
                      افتح <code>127.0.0.1:8765/pair</code> في المتصفح، وفي واتساب: الإعدادات ← الأجهزة المرتبطة ← ربط جهاز.
                    </p>
                  </li>
                  <li>
                    <strong>أضفه لمساعدك</strong>
                    <p>انسخ الإعداد تحت لبرنامجك، وأعد تشغيله.</p>
                  </li>
                </ol>
              </div>
              <div>
                <Code label="ماك ولينكس">{`curl -fsSL ${RAW}/scripts/install.sh | sh`}</Code>
                <Code label="ويندوز (PowerShell)">{`irm ${RAW}/scripts/install.ps1 | iex`}</Code>
                <Code label="Claude Code و Cursor">{`{ "mcpServers": { "whatsapp": {
    "type": "http",
    "url": "http://127.0.0.1:8765/mcp"
} } }`}</Code>
                <Code label="Claude Desktop (يحتاج Node.js)">{`{ "mcpServers": { "whatsapp": {
    "command": "npx",
    "args": ["-y", "mcp-remote", "http://127.0.0.1:8765/mcp"]
} } }`}</Code>
                <p>
                  تفضّل التحميل اليدوي؟ <a href={`${REPO}/releases/latest`}>كل النسخ في صفحة الإصدارات</a>.
                </p>
              </div>
            </div>
          </section>

          <section id="personal-cloud" aria-labelledby="pc-h">
            <div className="mode">
              <div>
                <h2 id="pc-h">حسابك الشخصي، بدون كمبيوتر</h2>
                <p className="intro">
                  نفس فكرة الجهاز المرتبط، لكن على فيرسل. ما تبقى متصلة دائماً: مع كل طلب من مساعدك تتصل لثواني، تسحب الرسائل الجديدة، وتقفل. مجانية على خطة Hobby.
                </p>
                <ol className="steps">
                  <li>
                    <strong>انشر نسختك</strong>
                    <p>بالزر تحت، واختر كلمتين سر طويلتين لـ MCP_SECRET و CRON_SECRET.</p>
                  </li>
                  <li>
                    <strong>أضف قاعدة البيانات</strong>
                    <p>Storage ← Upstash Redis ← Connect، ثم أعد النشر. فيها تنحفظ جلسة الربط والرسائل.</p>
                  </li>
                  <li>
                    <strong>اربط رقمك برمز</strong>
                    <p>
                      افتح <code>/personal</code> في نسختك، اكتب رقمك، وأدخل الرمز في جوالك من الأجهزة المرتبطة ← الربط برقم الهاتف.
                    </p>
                  </li>
                  <li>
                    <strong>أضفه لمساعدك</strong>
                    <p>
                      الرابط <code>/api/personal/mcp</code> مع كلمة السر.
                    </p>
                  </li>
                </ol>
              </div>
              <div>
                <p>
                  <a className="btn solid" href={DEPLOY_URL}>
                    انشر نسختك على فيرسل
                  </a>
                </p>
                <div className="note">
                  <p>
                    الفرق عن نسخة الكمبيوتر: كل طلب ياخذ من 5 إلى 20 ثانية لأنه يتصل أول، و11 أداة بدل 45. والاتصال من سيرفرات بدل جوالك يرفع احتمال تقييد الرقم، فاستخدمه لحسابك وبحدود معقولة.
                  </p>
                </div>
                <Code label="الإعداد في مساعدك">{`{ "mcpServers": { "whatsapp": {
    "type": "http",
    "url": "https://YOUR-APP.vercel.app/api/personal/mcp",
    "headers": { "Authorization": "Bearer YOUR_MCP_SECRET" }
} } }`}</Code>
              </div>
            </div>
          </section>

          <section id="official" aria-labelledby="official-h">
            <div className="mode">
              <div>
                <h2 id="official-h">الربط الرسمي لرقم الأعمال</h2>
                <p className="intro">
                  نسخة خاصة فيك على فيرسل، تتصل بواجهة Meta مباشرة بدون أي وسيط. مفاتيحك ورسائل عملائك في حسابك أنت.
                </p>
                <ol className="steps">
                  <li>
                    <strong>جهّز تطبيق Meta</strong>
                    <p>
                      من <a href="https://developers.facebook.com/apps">developers.facebook.com</a> أنشئ تطبيق Business وأضف له WhatsApp. لو رقمك على تطبيق WhatsApp Business، اختر ربطه بوضع التعايش عشان تكمّل تستخدم التطبيق.
                    </p>
                  </li>
                  <li>
                    <strong>انشر نسختك</strong>
                    <p>بالزر تحت، وبعدها أضف مفاتيح Meta من Settings ← Environment Variables.</p>
                  </li>
                  <li>
                    <strong>أضف قاعدة البيانات</strong>
                    <p>في مشروعك على فيرسل: Storage ← Upstash Redis ← Connect، ثم أعد النشر.</p>
                  </li>
                  <li>
                    <strong>وصّل الـ Webhook</strong>
                    <p>
                      في تطبيق Meta: WhatsApp ← Configuration، حط رابط <code>/api/webhook</code> ورمز التحقق، واشترك في <code>messages</code> (و <code>smb_message_echoes</code> لو تستخدم التعايش).
                    </p>
                  </li>
                  <li>
                    <strong>تأكد من كل شي</strong>
                    <p>
                      افتح <code>/setup</code> في نسختك، يوريك وش ناقص.
                    </p>
                  </li>
                </ol>
              </div>
              <div>
                <p>
                  <a className="btn solid" href={DEPLOY_URL}>
                    انشر نسختك على فيرسل
                  </a>
                </p>
                <div className="envs">
                  <code>WHATSAPP_ACCESS_TOKEN</code>
                  <span>مفتاح System User دائم من Meta Business</span>
                  <code>WHATSAPP_PHONE_NUMBER_ID</code>
                  <span>معرّف الرقم من WhatsApp ← API Setup</span>
                  <code>WHATSAPP_WABA_ID</code>
                  <span>معرّف حساب الأعمال، لعرض القوالب</span>
                  <code>META_APP_SECRET</code>
                  <span>من App settings ← Basic، يتحقق إن الرسائل جاية من Meta</span>
                  <code>WEBHOOK_VERIFY_TOKEN</code>
                  <span>أي نص تختاره</span>
                  <code>MCP_SECRET</code>
                  <span>كلمة سر طويلة تحمي نسختك، 24 حرف أو أكثر</span>
                </div>
                <Code label="بعدها أضف نسختك لمساعدك">{`{ "mcpServers": { "whatsapp-business": {
    "type": "http",
    "url": "https://YOUR-APP.vercel.app/api/mcp",
    "headers": { "Authorization": "Bearer YOUR_MCP_SECRET" }
} } }`}</Code>
              </div>
            </div>
          </section>

          <section aria-labelledby="risks-h">
            <h2 id="risks-h">قبل ما تبدأ</h2>
            <p className="intro">ثلاث أشياء لازم تعرفها مهما كانت الطريقة.</p>
            <div className="risks">
              <div>
                <h3>الرسائل ممكن تخدع المساعد</h3>
                <p>أي أحد يرسل لك ممكن يكتب تعليمات موجهة للمساعد. راجع كل رسالة قبل ما توافق على إرسالها، ولا تعطيه موافقة دائمة.</p>
              </div>
              <div>
                <h3>بياناتك عندك</h3>
                <p>على جهازك: في مجلد واحد على كمبيوترك. في الربط الرسمي: في قاعدة بيانات بحسابك على فيرسل. ما فيه أي سيرفر وسيط لنا.</p>
              </div>
              <div>
                <h3>مشروع مستقل</h3>
                <p>مفتوح المصدر بترخيص MIT، وما له علاقة بشركة Meta أو واتساب.</p>
              </div>
            </div>
          </section>
        </main>
      </div>

      <footer>
        <div className="wrap">
          مبني على شغل <a href="https://github.com/lharries/whatsapp-mcp">Luke Harries</a> و{" "}
          <a href="https://github.com/Sealjay/mcp-whatsapp">Chris Lloyd-Jones</a> ومكتبة{" "}
          <a href="https://github.com/tulir/whatsmeow">whatsmeow</a>. <a href={REPO}>الكود على GitHub</a>.
        </div>
      </footer>
    </>
  );
}
