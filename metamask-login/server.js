const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { getAddress, isAddress } = require("ethers"); // ✅ ethers 6.x 버전 대응

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());

mongoose.connect("mongodb://localhost:27017/metamaskDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("✅ MongoDB 연결 성공"))
  .catch(err => console.error("🚨 MongoDB 연결 실패:", err));

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    walletAddress: { type: String, unique: true },
    purchasedSkins: { type: [Number], default: [] },
    equippedSkin: {
        id: { type: Number, default: null },
        title: { type: String, default: "" }
    }
});

const User = mongoose.model("User", userSchema);

app.post("/api/register", async (req, res) => {
    try {
        let { username, password, walletAddress } = req.body;

        if (!username || !password || !walletAddress) {
            return res.status(400).json({ success: false, message: "🚨 ID, 비밀번호 및 지갑 주소를 입력하세요." });
        }

        // ✅ 지갑 주소를 소문자로 변환하여 저장
        walletAddress = walletAddress.toLowerCase();

        const existingUser = await User.findOne({ walletAddress });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "❌ 이미 등록된 MetaMask 계정입니다." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword, walletAddress });

        await newUser.save();
        res.json({ success: true, message: "✅ 회원가입 성공!" });

    } catch (error) {
        console.error("🚨 회원가입 오류:", error);
        res.status(500).json({ success: false, message: "서버 내부 오류 발생" });
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const { username, password, walletAddress } = req.body;
        if (!username || !password || !walletAddress) {
            return res.status(400).json({ success: false, message: "모든 필드를 입력하세요." });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ success: false, message: "아이디 또는 비밀번호가 틀렸습니다." });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password); // ✅ 비밀번호 검증
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: "아이디 또는 비밀번호가 틀렸습니다." });
        }

        const storedWalletAddress = user.walletAddress.toLowerCase();
        const formattedWalletAddress = walletAddress.toLowerCase();

        if (storedWalletAddress !== formattedWalletAddress) {
            return res.status(401).json({ success: false, message: "MetaMask 주소가 일치하지 않습니다." });
        }

        res.json({ success: true, message: "로그인 성공!" });

    } catch (error) {
        console.error("🚨 로그인 오류:", error);
        res.status(500).json({ success: false, message: "서버 내부 오류" });
    }
});


app.post("/api/metamask-login", async (req, res) => {
    const { walletAddress } = req.body;

    try {
        const user = await User.findOne({ walletAddress });

        if (!user) {
            return res.json({ success: false, message: "MetaMask 계정이 등록되지 않았습니다." });
        }

        res.json({ success: true, message: "MetaMask 로그인 성공!", walletAddress: user.walletAddress });
    } catch (error) {
        res.status(500).json({ success: false, message: "로그인 실패", error });
    }
});

// skin
app.post("/api/buy-skin", async (req, res) => {
    let { walletAddress, itemId } = req.body;

    if (!walletAddress || itemId === undefined) {
        return res.status(400).json({ success: false, message: "지갑 주소와 아이템 ID를 입력하세요." });
    }

    try {
        // 🔹 주소를 소문자로 변환하여 검색
        walletAddress = walletAddress.toLowerCase();

        let user = await User.findOne({ walletAddress });

        if (!user) {
            console.log(`🚨 사용자(${walletAddress})가 존재하지 않음`);
            return res.status(404).json({ success: false, message: "사용자가 존재하지 않습니다. 먼저 회원가입하세요." });
        }

        // ✅ 중복 구매 제한 제거
        user.purchasedSkins.push(itemId);
        await user.save();

        console.log(`✅ ${walletAddress}가 스킨(${itemId})을 구매함.`);
        res.json({ success: true, message: "스킨 구매 성공!", purchasedSkins: user.purchasedSkins });

    } catch (error) {
        console.error("🚨 스킨 구매 오류:", error);
        res.status(500).json({ success: false, message: "스킨 구매 실패", error });
    }
});


app.post("/api/equip-skin", async (req, res) => {
    let { walletAddress, skinId, skinTitle } = req.body;

    if (!walletAddress || skinId === undefined) {
        return res.status(400).json({ success: false, message: "지갑 주소와 아이템 ID를 입력하세요." });
    }

    if (!skinTitle) {
        skinTitle = "기본 스킨"; // 기본값 설정
    }

    try {
        // 🔹 **대소문자 구분 없이 검색하도록 정규식 적용**
        walletAddress = walletAddress.toLowerCase();
        const user = await User.findOne({ walletAddress: { $regex: new RegExp(`^${walletAddress}$`, "i") } });

        if (!user) {
            console.log(`🚨 [equip-skin] 사용자를 찾을 수 없음: ${walletAddress}`);
            return res.status(404).json({ success: false, message: "사용자가 존재하지 않습니다." });
        }

        // ✅ 기존 장착된 스킨을 강제로 교체하도록 수정
        user.equippedSkin = { id: skinId, title: skinTitle };
        await user.save();

        console.log(`✅ ${walletAddress}가 스킨(${skinId} - ${skinTitle})을 장착함.`);
        res.json({ success: true, message: `스킨(${skinTitle}) 장착 성공`, equippedSkin: user.equippedSkin });

    } catch (error) {
        console.error("🚨 스킨 장착 중 오류 발생:", error);
        res.status(500).json({ success: false, message: "스킨 장착 실패", error });
    }
});


app.post("/api/un-equip-skin", async (req, res) => {
    let { walletAddress } = req.body;

    if (!walletAddress) {
        return res.status(400).json({ success: false, message: "지갑 주소를 입력하세요." });
    }

    walletAddress = walletAddress.toLowerCase();

    try {
        const user = await User.findOne({ walletAddress });

        if (!user) {
            return res.status(404).json({ success: false, message: "사용자를 찾을 수 없습니다." });
        }

        // ✅ 이미 해제된 경우 경고 메시지 출력
        if (!user.equippedSkin || user.equippedSkin.id === null) {
            return res.status(400).json({ success: false, message: "장착된 스킨이 없습니다." });
        }

        console.log(`❌ ${walletAddress}가 스킨(${user.equippedSkin.id} - ${user.equippedSkin.title}) 장착 해제.`);

        // ✅ 장착 해제 처리
        user.equippedSkin = { id: null, title: "" };
        await user.save();

        res.json({ success: true, message: "스킨 장착 해제 성공!" });

    } catch (error) {
        console.error("🚨 스킨 장착 해제 오류:", error);
        res.status(500).json({ success: false, message: "스킨 장착 해제 실패", error });
    }
});

app.post("/api/get-skins", async (req, res) => {
    let { walletAddress } = req.body;

    if (!walletAddress) {
        return res.status(400).json({ success: false, message: "지갑 주소를 입력하세요." });
    }

    try {
        // 🔹 **대소문자 구분 없이 검색하도록 정규식 적용**
        walletAddress = walletAddress.toLowerCase();
        const user = await User.findOne({ walletAddress: { $regex: new RegExp(`^${walletAddress}$`, "i") } });

        if (!user) {
            console.log(`🚨 [get-skins] 사용자를 찾을 수 없음: ${walletAddress}`);
            return res.status(404).json({ success: false, message: "사용자가 존재하지 않습니다." });
        }

        res.json({
            success: true,
            purchasedSkins: user.purchasedSkins || [],
            equippedSkin: user.equippedSkin || { id: null, title: "" }
        });

    } catch (error) {
        console.error("🚨 스킨 정보 불러오기 실패:", error);
        res.status(500).json({ success: false, message: "스킨 정보 불러오기 실패", error });
    }
});




app.post("/api/get-purchased-skins", async (req, res) => {
    try {
        const { walletAddress } = req.body;

        if (!walletAddress) {
            return res.status(400).json({ success: false, message: "지갑 주소가 필요합니다." });
        }

        // 🔹 데이터베이스에서 구매한 스킨을 조회하는 코드 (예제)
        const user = await User.findOne({ walletAddress }); // 예제 코드 (DB 확인 필요)
        const purchasedSkins = user ? user.purchasedSkins : [];

        res.json({ success: true, purchasedSkins });
    } catch (error) {
        console.error("🚨 get-purchased-skins API 오류:", error);
        res.status(500).json({ success: false, message: "서버 오류 발생" });
    }
});


app.listen(PORT, () => {
    console.log(`서버 실행 중: http://localhost:${PORT}`);
});
