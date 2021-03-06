define([
    'app/controller/base',
    'app/util/ajax',
    'app/module/loading/loading'
], function(base, Ajax, loading) {
    var rate = base.getUrlParam("rate");
    var code = base.getUrlParam("c"),
        name = base.getUrlParam("n");
    var choseIdx = 0, totalAmount = 0, discountAmount = 0;
    var cny2jf_rate = 1, rmbRemain = 0, jfRemain = 0;

    initView();

    function initView() {
        addListeners();
        if (code) {
            loading.createLoading();
            
            $("#name").text(name);
            $.when(
                getAccount(),
                getCNY2JFRate()
            ).then(loading.hideLoading, loading.hideLoading);
        } else {
            base.showMsg("未传入订单编号!");
        }
    }
    // 获取账户信息
    function getAccount(){
        return Ajax.get("802503", {
            userId: base.getUserId()
        }).then(function(res){
            if(res.success){
                var data = res.data;
                data.forEach(function(d, i){
                    if(d.currency == "CNY"){
                        rmbRemain = +d.amount;
                        $("#rmbRemain").html("¥" + base.formatMoneyD(d.amount));
                    }else if(d.currency == "CGJF"){
                        jfRemain = +d.amount
                        $("#jfRemain").html(base.formatMoneyD(d.amount));
                    }
                })
            }
        });
    }
    // 获取人民币转抵金券汇率
    function getCNY2JFRate(){
        return getTransRate("CNY", "CGJF");
    }
    // 获取转化汇率
    function getTransRate(from, to){
        return Ajax.get("002051", {
            fromCurrency: from,
            toCurrency: to
        }).then(function(res){
            cny2jf_rate = res.data.rate;
        });
    }
    function addListeners() {
        $("#content").on("click", ".pay-item", function() {
            var _self = $(this),
                idx = _self.index();
            _self.siblings(".active").removeClass("active");
            _self.addClass("active");
            choseIdx = idx;
        });
        $("#rmbAmount").on("keyup", function(){
            var self = $(this),
                value = self.val();
            if($.isNumeric(value)){
            	if(!/^\d+(\.\d{1,2})?$/.test(value)){
            		base.showMsg("小数点后最多两位")
            	}else{
	                var needAmount = value * 1000 ,
	                	needJF = value* 1000-(base.formatMoney(needAmount)*1000);
                        totalAmount = value*1000;
	                    
	                $("#jfAmount").val(base.formatMoneyD(needJF));
	                $("#needAmount").val(base.formatMoney(needAmount));
                    $("#totalAmount").html(base.formatMoney(needAmount));
	            }
            }else{
                totalAmount = 0;
                discountAmount = 0;
                $("#TreatAmount").val(0);
                $("#jfAmount").val(0);
                $("#needAmount").val(0);
                $("#totalAmount").html(0);
            }
        });
        $("#TreatAmount").on("keyup", function(){
            var self = $(this),
                value = self.val();
            var spendAmount = $("#rmbAmount").val();
            if($.isNumeric(value)){
                if(!/^\d+(\.\d{1,2})?$/.test(value)){
                    base.showMsg("小数点后最多两位")
                }else{
                    var needAmount = value * 1000* (1 - rate) + (spendAmount - value) * 1000 ,
                        needJF = spendAmount* 1000-(base.formatMoney(needAmount)*1000);
                        discountAmount = value*1000;
                        totalAmount = spendAmount*1000;
                        
                    $("#jfAmount").val(base.formatMoneyD(needJF));
                    $("#needAmount").val(base.formatMoney(needAmount));
                    if(jfRemain < needJF){
                        var a1 = (needJF - jfRemain);
                        var a2 = (a1 / cny2jf_rate);
                        $("#totalAmount").html(base.formatMoney(a2 + needAmount));
                    }else{
                        $("#totalAmount").html(base.formatMoney(needAmount));
                    }
                }
            }else{
                var needAmount = spendAmount * 1000 ,
                    needJF = spendAmount* 1000-(base.formatMoney(needAmount)*1000);
                    totalAmount = spendAmount*1000;
                    discountAmount = 0;
                $("#jfAmount").val(base.formatMoneyD(needJF));
                $("#needAmount").val(base.formatMoney(needAmount));
                $("#totalAmount").html(base.formatMoney(needAmount));                
            }
        });
        $("#sbtn").click(function(){
        	if($("#rmbAmount").val()){
        		if(!/^\d+(\.\d{1,2})?$/.test($("#rmbAmount").val())){
            		base.showMsg("小数点后最多两位")
            	}else{
            		if(choseIdx == 0){  //  余额支付
		                pay(21);
		            }else { //微信支付
		                pay(5);
	            	}
            	}
        		
        	}else{
        		base.showMsg("请输入消费金额")
        	}
            
        });
    }

    function pay(payType){
        loading.createLoading("支付中...");
        Ajax.post("808243", {
            json: {
                storeCode: code,
                userId: base.getUserId(),
                amount: totalAmount,
                disPrice: discountAmount,
                payType: payType,
                isOnlyRmb: 0
            }
        }).then(function(res){

            if(res.success){
            	
                loading.hideLoading();
                if(payType == 21){
                    base.confirm("支付成功,是否返回商家详情").then(function(){
            			location.href = "../consume/detail.html?c="+code;
            		},function(){})
                }else{
                    wxPay(res.data);
                }
            }else{
                loading.hideLoading();
                if(res.msg=="抵金券不足"){
                	base.confirm("抵金券余额不足，是否前往兑换？","否","是").then(function(){
                		
                        location.href = "../user/buyIntegral.html";
                	},function(){
                        location.href = "../consume/detail.html?c="+code;
                	})
                }else if(res.msg=="人民币不足"){
                	base.confirm("账户余额不足，是否前往充值？","否","是").then(function(){
                		
                        location.href = "../pay/cny_recharge.html";
                	},function(){
                        base.confirm("支付成功,是否返回商家详情").then(function(){
                			location.href = "../consume/detail.html?c="+code;
                		},function(){})
                	})
                }else{
                	base.showMsg(res.msg);
                }
            }
        })
    }
    var wxConfig = {};

    function onBridgeReady() {
        WeixinJSBridge.invoke(
            'getBrandWCPayRequest', {
                "appId": wxConfig.appId, //公众号名称，由商户传入
                "timeStamp": wxConfig.timeStamp, //时间戳，自1970年以来的秒数
                "nonceStr": wxConfig.nonceStr, //随机串
                "package": wxConfig.wechatPackage,
                "signType": wxConfig.signType, //微信签名方式：
                "paySign": wxConfig.paySign //微信签名
            },
            function(res) {
                loading.hideLoading();
                // 使用以上方式判断前端返回,微信团队郑重提示：res.err_msg将在用户支付成功后返回    ok，但并不保证它绝对可靠。
                if (res.err_msg == "get_brand_wcpay_request:ok") {
                    base.confirm("支付成功,是否返回商家详情").then(function(){
                			location.href = "../consume/detail.html?c="+code;
                		},function(){})
                } else {
                    base.showMsg("支付失败");
                }
            }
        );
    }
    function wxPay(data){
        wxConfig = data;
        if (data && data.signType) {
            if (typeof WeixinJSBridge == "undefined") {
                if (document.addEventListener) {
                    document.removeEventListener("WeixinJSBridgeReady", onBridgeReady);
                    document.addEventListener('WeixinJSBridgeReady', onBridgeReady, false);
                } else if (document.attachEvent) {
                    document.detachEvent('WeixinJSBridgeReady', onBridgeReady);
                    document.detachEvent('onWeixinJSBridgeReady', onBridgeReady);
                    document.attachEvent('WeixinJSBridgeReady', onBridgeReady);
                    document.attachEvent('onWeixinJSBridgeReady', onBridgeReady);
                }
            } else {
                onBridgeReady();
            }
        } else {
            loading.hideLoading();
            base.showMsg(data.msg || "微信支付失败");
        }
    }
});
