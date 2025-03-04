const NFT_CONTRACT_ADDRESS = "0xdb1b7d8aedc830825836790b125fff3773382d6b"; 
const GANACHE_RPC_URL = "http://127.0.0.1:7545"; 
const PINATA_JWT = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJiNTk2Y2MyYS01NDY2LTQyNGItYjRlMC03OTVkMTIzNGI5ODAiLCJlbWFpbCI6Im9tajk5MDhAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjhmNDJiOGI4ZjE3MDFkOGM2ZGVhIiwic2NvcGVkS2V5U2VjcmV0IjoiNWM3MjE5ZDJmN2U5MzA3MTFlYTA0NjQyNDM3OTBhZTU5MThmZTU4NDY4MGUxNGNmMmI5OWJkZmNiMGI5YTllMCIsImV4cCI6MTc3MDM1MzkwM30.qCRw21knqdTqWg6rTb3_ujnnOyl-Wz0FpOLoV7BN2B0"; // Pinata JWT (환경 변수 사용 권장)

let provider, signer, nftContract, currentAccount;

const ABI_NFT = [
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "string", "name": "name", "type": "string" },
            { "internalType": "string", "name": "description", "type": "string" },
            { "internalType": "string", "name": "tokenURI", "type": "string" },
            { "internalType": "uint256", "name": "price", "type": "uint256" }
        ],
        "name": "mintNFT",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
];

async function connectWallet() {
    if (!window.ethereum) {
        alert("🚨 MetaMask가 설치되어 있지 않습니다!");
        return;
    }

    try {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        currentAccount = await signer.getAddress();
        nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, ABI_NFT, signer);

        document.getElementById("walletAddress").textContent = `🔗 ${currentAccount}`;
        console.log("✅ MetaMask 연결 완료:", currentAccount);
    } catch (error) {
        console.error("🚨 MetaMask 연결 실패:", error);
    }
}

async function uploadToIPFS(file, name, description) {
    const formData = new FormData();
    formData.append("file", file);

    try {
        console.log("📌 [Pinata] 이미지 업로드 중...");

        const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
            method: "POST",
            headers: { "Authorization": PINATA_JWT },
            body: formData
        });

        const data = await response.json();
        if (!data.IpfsHash) throw new Error("❌ IPFS 이미지 업로드 실패");

        const imageUrl = `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
        console.log("✅ [Pinata] 이미지 업로드 완료:", imageUrl);

        const metadata = { name, description, image: imageUrl };

        console.log("📌 [Pinata] 메타데이터 업로드 중...");

        const metadataResponse = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
            method: "POST",
            headers: {
                "Authorization": PINATA_JWT,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(metadata)
        });

        const metadataData = await metadataResponse.json();
        if (!metadataData.IpfsHash) throw new Error("❌ IPFS 메타데이터 업로드 실패");

        const metadataURI = `https://gateway.pinata.cloud/ipfs/${metadataData.IpfsHash}`;
        console.log("✅ [Pinata] 메타데이터 업로드 완료:", metadataURI);
        return metadataURI;
    } catch (error) {
        console.error("🚨 [Pinata] 업로드 오류:", error);
        return null;
    }
}

async function mintNFT() {
    console.log("📌 [Debug] mintNFT() 실행됨");

    if (!nftContract) {
        console.error("❌ NFT 스마트 컨트랙트가 초기화되지 않았습니다.");
        alert("🚨 NFT 스마트 컨트랙트가 초기화되지 않았습니다! MetaMask를 다시 연결하세요.");
        return;
    }

    const mintButton = document.getElementById("mintButton");
    if (mintButton) {
        mintButton.disabled = true; // 🚀 버튼 중복 클릭 방지
    }

    const fileInput = document.getElementById("upload");
    if (!fileInput || !fileInput.files.length) {
        console.error("❌ 파일이 선택되지 않음");
        alert("📌 이미지를 선택하세요.");
        if (mintButton) mintButton.disabled = false;
        return;
    }

    const name = document.getElementById("nftName").value.trim();
    const description = document.getElementById("description").value.trim();
    const price = document.getElementById("price").value.trim();

    if (!name || !description || !price || isNaN(price) || parseFloat(price) <= 0) {
        console.error("❌ 입력값 부족 (이름, 설명, 가격)");
        alert("📌 모든 필드를 올바르게 입력하세요! (가격은 0보다 커야 합니다)");
        if (mintButton) mintButton.disabled = false;
        return;
    }

    console.log("📌 [NFT 민팅] Pinata 업로드 시작...");

    const resultElement = document.getElementById("result");
    const metadataLink = resultElement.querySelector("a");
    if (!metadataLink || !metadataLink.href) {
        console.error("❌ 유효한 메타데이터 URI 없음: 'result' 요소에 링크 없음");
        alert("🚨 IPFS 업로드 후 다시 시도하세요.");
        if (mintButton) mintButton.disabled = false;
        return;
    }

    const metadataURI = metadataLink.href;
    console.log("📌 [Debug] 메타데이터 URI 가져오기:", metadataURI);

    try {
        console.log("📌 [NFT 민팅] 관리자 계정 확인 중...");
        
        // ✅ 올바르게 `owner()` 호출
        const contractOwner = await nftContract.owner();
        console.log(`✅ 컨트랙트 관리자: ${contractOwner}`);
        console.log(`✅ 현재 계정: ${currentAccount}`);

        if (currentAccount.toLowerCase() !== contractOwner.toLowerCase()) {
            console.error("❌ 관리자만 NFT를 민팅할 수 있습니다!");
            alert("🚨 관리자만 NFT를 민팅할 수 있습니다!");
            if (mintButton) mintButton.disabled = false;
            return;
        }

        console.log("📌 [NFT 민팅] 블록체인 트랜잭션 실행...");

        const priceInWei = ethers.utils.parseUnits(price, "ether");
        const nftWithSigner = nftContract.connect(signer);

        // ✅ 올바르게 `mintNFT()` 호출
        const tx = await nftWithSigner.mintNFT(name, description, metadataURI, priceInWei);
        console.log("✅ [NFT 민팅 완료] 트랜잭션 해시:", tx.hash);

        const receipt = await tx.wait();
        console.log("📌 [Debug] 트랜잭션 수신 완료:", receipt);
        console.log("📌 [Debug] 트랜잭션 이벤트 목록:", receipt.events);

        let tokenId = null;
        for (const event of receipt.events) {
            console.log("📌 [Debug] 개별 이벤트:", event);

            if (event.event === "NFTMinted" && event.args) { 
                tokenId = event.args.tokenId.toString();
                break;
            }
        }

        if (tokenId) {
            console.log("✅ [NFT 민팅 성공] Token ID:", tokenId);
            alert(`✅ NFT 민팅 성공! Token ID: ${tokenId}`);
        } else {
            console.warn("⚠️ 민팅 성공했지만 Token ID를 찾을 수 없음.");
            alert("✅ NFT 민팅 성공! (Token ID 확인 불가)");
        }
        

        console.log("✅ [NFT 민팅 성공] Token ID:", tokenId);
        alert(`✅ NFT 민팅 성공! Token ID: ${tokenId}`);

    } catch (error) {
        console.error("🚨 [NFT 민팅 실패]:", error);
        alert(`🚨 NFT 민팅 실패! 오류 메시지: ${error.message}`);
    } finally {
        if (mintButton) mintButton.disabled = false;
    }
}


document.getElementById("uploadButton").addEventListener("click", async function () {
    const fileInput = document.getElementById("upload");
    const resultDisplay = document.getElementById("result");

    if (!fileInput.files.length) {
        alert("📌 이미지를 선택하세요.");
        return;
    }

    resultDisplay.textContent = "📤 Pinata에 업로드 중... 잠시만 기다려 주세요.";
    const file = fileInput.files[0];
    const metadataURI = await uploadToIPFS(file, "NFT 이미지", "이 이미지는 NFT로 민팅됩니다.");

    if (!metadataURI) {
        resultDisplay.textContent = "❌ 이미지 업로드 실패";
        alert("🚨 이미지 업로드에 실패했습니다.");
        return;
    }

    resultDisplay.innerHTML = `✅ 업로드 완료! <a href="${metadataURI}" target="_blank">${metadataURI}</a>`;
    console.log("✅ [Pinata] 업로드 완료:", metadataURI);
});

document.getElementById("mintButton").addEventListener("click", async function () {
    console.log("📌 [Debug] NFT 민팅 버튼 클릭됨!");
    await mintNFT();
});

window.onload = async function () {
    try {
        await connectWallet();
    } catch (error) {
        console.error("🚨 [오류] 페이지 로드 중 문제 발생:", error);
    }
};