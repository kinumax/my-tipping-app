// api/create-xumm-payment.js
import { XummSdk } from 'xumm-sdk'; // XUMM SDKをインポート

export default async function handler(req, res) {
  // POSTリクエストのみを受け付ける
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // 環境変数からAPIキーとシークレットを取得
  // Vercelで設定した環境変数は、process.env でアクセスできます。
  const XUMM_API_KEY = process.env.XUMM_API_KEY;
  const XUMM_API_SECRET = process.env.XUMM_API_SECRET;

  if (!XUMM_API_KEY || !XUMM_API_SECRET) {
    console.error('XUMM API Key or Secret not set in environment variables.');
    return res.status(500).json({ message: 'Server configuration error: XUMM API keys are missing.' });
  }

  // XUMM SDKの初期化
  const Sdk = new XummSdk(XUMM_API_KEY, XUMM_API_SECRET);

  const { destination, amount } = req.body;

  if (!destination || !amount) {
    return res.status(400).json({ message: 'Destination address and amount are required.' });
  }

  try {
    // 支払いペイロードの作成
    const payload = await Sdk.payload.create({
      TransactionType: 'Payment',
      Destination: destination,
      Amount: Sdk.xrpToDrops(amount.toString()), // XRPからDropsに変換
      // Optional: Memoを追加する場合はここに
      // Memos: [
      //   {
      //     Memo: {
      //       MemoData: Buffer.from('Optional memo for your transaction').toString('hex')
      //     }
      //   }
      // ],
      ReturnUrl: {
        web: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000', // トランザクション完了後に戻るURL
        app: 'xaman://' // アプリに戻るディープリンク (任意)
      }
    });

    if (payload && payload.next && payload.next.always && payload.refs && payload.refs.qr_png) {
      res.status(200).json({
        qrCodeUrl: payload.refs.qr_png, // QRコード画像のURL
        xummDeepLink: payload.next.always, // XUMMアプリで直接開くためのディープリンク
        payloadUuid: payload.uuid // ペイロードのUUID (ステータス監視などに利用可能)
      });
    } else {
      console.error('XUMM payload creation failed or missing data:', payload);
      res.status(500).json({ message: 'Failed to create XUMM payment payload.' });
    }

  } catch (error) {
    console.error('Error creating XUMM payment payload:', error);
    res.status(500).json({ message: 'Internal server error during XUMM payload creation.', error: error.message });
  }
}
