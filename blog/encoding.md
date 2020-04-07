### 关于编码

人类社会人与人之间可以通过语言，文字，动作等多种方式进行交流沟通，在进入计算机时代，计算机并不能直接理解人类语言文字，这时就需要一种载体能够将人类的语言或者文字符号转换成计算机可以识别的语言。编码就是这样的载体，她将文字符号按照某种规则转换成计算机能够识别的格式存储起来，这样人类就可以和计算机按照这个规则相互转换进行交流了。**这里面表示符号的集合我们称之为字符集，与之对应的在计算机中的存储格式就是编码**。常用的字符集有: ASCII, Unicode, GB2312, GBK, GB18030, ISO-8859-1。对应的他们都有各自的编码存储方式。当我们提到ASCII，GBK或者unicode码时，我们要明确指的是字符集还是编码，我们虽然经常将其混在一起称呼，但不能将其混淆。另外还需要说明的是GB2312,GBK,ISO-8859-1等都是在ASCII码的基础上组合实现的编码，他们互不兼容，为了解决这个问题，unicode码应运而生，她基本上包含了所有可用的文字符号(1个基本平面+16个扩展平面 - 17*65536=1114112个符号)，具体下面会有介绍。

unicode本身只是字符集，虽然unicode码基本上包含了所有的文字符号，但是unicode码只规定了符号的二进制代码，如人的unicode码是20154(十进制表示形式)`"人".charCodeAt(0)`，相应的二进制是0b100111010111010, 一共15位，占用3个字节，那么如果我们直接采用二进制码作为编码时，我们就需要面对这样的问题：如何判断几个字节代表一个符号？我们如何判断“人”这个符号需要占用3个字节？由于unicode码普遍采用USC-2的方案，也就是说占用2个字节来表示符号的方案，那么如果一个简单的英文字符就需要占用2个字节，未免太浪费空间。

为了解决这个问题，于是便有了UTF-8编码，UTF-8采用变长字节码的编码格式，如果是英文字符时，只用占用1个字节，这就解决了浪费空间的问题。


为了解决这个问题于是便有了三种相关存储的实现方式:UTF-8，UTF-16或者UTF-32,其中UTF-8使用比较广泛, 其采用可变长度字节来存储unicode字符(1-4个字节来表示一个符号)，而UTF-16则一般采用2个字节表示一个字符，UTF-32采用4个字节。

以UTF-8为例，看看如何解决上面的两个问题，首先由于UTF-8采用变长的编码格式，所以如果是英文字符时

编码就像一把钥匙，一把钥匙只能开一把锁，如果我们在网络传输中用的是UTF-8编码传输数据，那么数据接收端（客户端或者服务器）端肯定不能用GBK编码这把钥匙打开，这就是乱码产生的原因。计算机发展至今已产生很多编码格式，下面简单的介绍了其发展历程以及其中一些必要的知识点。

### 一段故事

老外用类似于“灯泡”的晶体管生产出来了第一台计算机，他们用8个“灯泡”（1个字节）组合出不同的状态（256种），然后从00开始，依次给设置一个对应值，直到填满至第127位（_0x7f_）：其中控制码(_0-31/0x00-0x19_)、空格(32)、标点符号、数字、大小写字母等（具体可参加[ASCII码表](http://www.asciitable.com/)），这127种状态后来就被称为**ASCii**码。随后有些西方国家利用127位以后的空位，填充他们需要的新的字符和符号，直至填满，这样这全部的256种状态就构成了新的编码：**ISO-8859-1**。

当计算机到了中国，为了满足汉字的需要，我们保留前127位ASCii码不变，取2个字节组合的方式（_161-255/0xA1-0xFE_）来表示汉字（94区94位），这就是**GB2312**，但是这种组合却仅有7000多个简体汉字，为了支持更多的汉字，于是我们就扩大这两个字节的选取范围，高字节大于128（_0x81-0xFE_）,低字节大于63（_0x40-0xFE_），这样就增加了20000多字，我们称之为**GBK**。可是别忘了我们还有少数名族，于是我们在GB2312，GBK这种单（ASCII）双字节(汉字)的基础上添加4个字节表示一个字符，其中一三字节范围_0x81-0xFE_，二四字节范围：_0x30-0x39_，这就是**GB18030**。

如此一来各个国家都搞出一套自己的编码，相互重叠，除了ASCII，谁也不支持别人的编码。为了解决这种混乱现象，自然就有组织制定了统一的标准把全球的语言都给编了进去，**UCS**和**unicode**应运而生,分别由ISO和unicode.org来设计。为了防止两个组织的带来的混乱，从unicode2.0后，
两者规范进行了统一。

UCS有两种格式，分别是USC-2(_0x0000-0xFFFF_)，USC-4(_0x0000-0x10FFFF_)。通过名字可以看出UCS-2就是用两个字节编码，UCS-4就是用4个字节（实际上只用了31位，最高位必须为0）编码，UCS-2有2^16=65536个码位（这大概已经可以覆盖大部分的符号了），UCS-4有2^31=2147483648个码位，UCS-2前面加上2个全是0的字节就变成了UCS-4。
前期Unicode被设计为16bit，即每个符号占2byte，最多表示65536个符号(相当于UCS-2)。而后随着符号越来越多，同时还要兼容之前的规则，于是将最早的65536个字符集合称为基本平面，并添加16个辅助平面（总共支持65536 * 17 = 1114112个符号）。由于原来的16bit不够用了，需要21bit才能准确描述一个符号，相当于3b，但是为了以后扩展方便及统一，辅助平面的符号要求使用4byte描述。

由于unicode则采用两个字节，也就是16位来统一表示所有的字符，因此我们可以暂且将UCS-2与Unicode等同看待。ECMAScript规定里的Code Source字符集即为UCS-2。然而unicode在制订时没有考虑与任何一种现有的编码方案保持兼容，**我们可以通过查表来进行转换。**

我们前面谈过，unicode码不管是汉字还是英文字符，都占用2个字节未免有点浪费资源，于是就有了针对unicode传输的可变编码：**UTF-8**。UTF-8：8位编码，ASCII不作变换, 其他字符做变长编码, 每个字符1-4位。Unicode到UTF并不是直接的对应，可以通过一些算法和规则来转换。下面是Unicode到UTF-8的转换对应关系(中文的话也可以用encodeURI函数处理)，我们将Unicode码转换成2进制，然后从右向前依次替代第二列中对应的x，直至填完，空位补0.

![Unicode转UTF-8](https://raw.githubusercontent.com/abcrun/abcrun.github.com/master/images/encoding/utf-8.png)

举个简单的例子: 

1. '人'的unicode编码是20514**`"人".charCodeAt(0)`**
2. 转换成16进制则为 "4eba"**`"人".charCodeAt(0).toString(16)`**
3. 查表发现unicode编码对应第三行规则，将unicode编码转化为二进制表示方式**`"人".charCodeAt(0).toString(2)`**则是"100 111010 111010",
4. 根据表中的规则，从右向左依次设置zzzzzz为111010，yyyyyy为111010,xxxx为0100(最左边空位补0)，因此最终'人'的UTF-8编码表示为: 01001110 10111010(xxxxyyyy yyzzzzzz),而对应的二进制表示为: 11100100 10111010 10111010 转化为16进制则是: `e4baba` 也可以通过encodeURI('人')得出UTF-8的16进制(关于encodeURI后面将会详细介绍)。

**综上我们可以看到同一个汉字，不同的编码规则对应的16进制，二进制的值都是不一样的，这一点很重要，不能简单的认为任何一个字符对应的二进制都是唯一的，具体的值取决于编码格式**

UTF-8包含的范围这么广，为什么国内很多互联网大佬还用GBK或者GB2312呢？这里包含着历史的缘故，但是还有个主要原因就是**字节**，UTF-8中文字符要占2-4个字节，而GB2312/GBK却只需要2个字节。

下面说一下Javascript中的基础转码和字节运算。

### Javascript基础编码及转换

* 进制表示方式

```
	var num1 = 10; //十进制
	var num2 = O71; //八进制 - 57
	var num3 = 0xE1; //16进制 - 225
	var num4 = 0b110; //2进制 - 6
```

* 数字进制转换

```
	var num1 = 12;
	num1.toString(2); //转换为2进制
	
	var num2 = 071;
	parseInt(num2, 8); //转换成10进制 
```
**上面转换2进制时只能处理正数，如果是负数你会发现，这个方法是无用的(`parseInt(-2).toString(2);//-10，实际上应该是11111110`)，至于如何将负数转换成2进制(简单地说就是正数取反加一)，有时间我会总结一篇关于Javascript位运算相关的文章来具体介绍。**

* 字符编码转换(字符必须先通过转换成unicode码后才能做转换)

```
	var str = '人';
	var unicode = str.charCodeAt(0); //unicode编码20514
	var num = str.charCodeAt(0).toString(16); //转换为16进制
```

### Javascript中的编码转换函数

[ECMA-262 5.1 Edition](http://www.ecma-international.org/publications/files/ECMA-ST/Ecma-262.pdf)规定Javascript的source text是Unicode编码，Javascript代码在解释时将被首先会被转换成UTF-16编码。

> ECMAScript source text is represented as a sequence of characters in the Unicode character encoding,version 3.0 or later. ... ... ECMAScript source text is assumed to be a sequence of 16-bit code units for the purposes of this specification. Such a source text may include sequences of 16-bit code units that are not valid UTF-16 character encodings. If an actual source text is encoded in a form other than 16-bit code units it must be processed as if it was first converted to UTF-16.

尽管NodeJS给Javascript注入的新的血液，可以做加密运算等很多的编码转换（如 [BASE64](http://baike.baidu.com/link?url=mWDCvWWLyFQ3-q8lleOr0a0rdluUpIY7GouKYy5z4ivXHG8iavue9xq21CH0WN1V)，[哈希](http://www.cnblogs.com/luyinghuai/archive/2008/08/28/1278491.html)），但是对于前端开发人员来说，Javascript仅仅给出了三组编码转换的接口，所以期望Javascript前端工程师在编码上做更多的处理都是想法都是不可取的。[这些API](http://www.w3schools.com/jsref/jsref_obj_global.asp)都是全局函数，包括：

| Function | Description |
| --- | --- |
| decodeURI() | Decodes a URI |
| decodeURIComponent() | Decodes a URI component |
| encodeURI() | Encodes a URI |
| encodeURIComponent() | Encodes a URI component |
| escape() | _Deprecated in version 1.5_. Use encodeURI() or encodeURIComponent() instead |
| unescape() | _Deprecated in version 1.5_. Use decodeURI() or decodeURIComponent() instead |

新增: **window.atob(str) window.btoa(str)** base64的编码与解码

##### escape

> For those characters being replaced whose code unit value is 0xFF or less, a two-digit escape sequence of the form %xx is used. For those characters being replaced whose code unit value is greater than 0xFF, a four-digit escape sequence of the form %uxxxx is used.

可以简单的认为escape是以0xFF(255)为界，大于他的将会被转换成unicode编码的**16进制格式**，而比其小的除了以下这些字符外：

```
ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@*_+-./
```

会被转换成%xx的形式。

##### encodeURI 和 encodeURIComponent

> The encodeURI or encodeURIComponent function computes a new version of a URI in which each instance of certain characters is replaced by one, two, three, or four escape sequences representing the UTF-8 encoding of the character.

这两个方法可以将中文字符或者其他一些字符转换成UTF-8编码以16进制表示（%**表示），先来看一下ECMAScript对URI的语法规定（RFC 2396）：

![URI语法](https://raw.githubusercontent.com/abcrun/abcrun.github.com/master/images/encoding/uri.png)

从上图可以发现URI的token主要有四部分组成：uriReserved，uriAlpha，uriMark，**uriEscaped**，而uriEscaped实际上就是对不匹配前三种字符集的那些字符转换成UFT-8的16进制编码。

encodeURI 和 encodeURIComponent的区别在于是否对**uriReserved**里面的字符进行转换。

##### window.atob 和 window.btoa

`window.btoa(str)`，将str转换成base64编码格式，反之`window.atob(str)`则是将base64编码转回。然后str参数不支持中文，否则将会报错，所以我们可以现将str转换成URI格式，然后在base64，反之解码亦然需要decodeURI。

尽管如此，并非所有浏览器都支持这两个方法，因此我们可以通过传统的方法来处理base64编码。具体算法：**将3个字节24位数据，以每6位一个ASCII码来表示，一共4个字符**


### 编码与安全

我们知道XSS攻击很多时候都是通过分析URI中参数查找漏洞，然后利用页面中给DOM元素的属性赋值或者通过innerHTML添加内容，或者通过CSS Expression等进行攻击的。举个简单的例子：

```
    <div id="xss"></div>
    <script type="text/javascript">
        //页面的URL是:http://test.com?<script>alert(1)</script>
        var data = document.URL.split('?')[1];
        document.getElementById('xss').innerHTML = data;
    </script>
```

所以说页面的URL非常重要，有一些特殊字符是利用URI进行攻击的主要原因，如何页面没有对URL中的`< >`进行编码转换，那就会被利用进行攻击。幸运的是现在浏览器厂商都引用了XSS filter机制，会对一些可能会引起攻击的字符进行编码转换如：< > " ' `等，然而可惜的是IE浏览器并不支持这些字符的编码转换，而Chrome也仅仅对 < > " 这三个字符进行编码，所以当我们需要传递这些参数的时候还是需要通过 `encodeURIComponent()`方法对参数进行转换。

还有个问题就是利用浏览器自转码问题。HTML页面可以包含实体编码，如&nbsp;相当于空格，同时也支持进制编码：&#xH;(十六进制)，&#D;(十进制)；而Javascript文件除了支持unicode编码外，也支持十六进制的编码\xH。这些特性都可能会成为攻击时被利用的对象，所以一定要在页面的输入和输出点加以判断。

### 乱码问题

关于编码最主要就是乱码问题了，这主要发生在前后端交互中。然而还有个问题需要注意，就是Javascript文件中中文字符的问题。

##### 1.Javascript文件中得中文字符问题

出于性能考虑，我们往往会将JS文件压缩混淆(利用unglifyJS，yuicompressor，closure等)，然而假如JS文件采用了GBK编码且里面包含中文字符，这时如果用UTF-8编码进行压缩，那么就会产生乱码。

如何解决这个问题呢？我们知道YUICompressor可以指定压缩编码(`--charset gbk`)，但是并非所有的工具都可以这么做，比如UglifyJS就仅仅支持UTF-8编码，这时我们可以选择那些支持设置编码的压缩工具。当然如果必须使用UglifyJS呢？这时可以将JS文件中的中文字符给转换成unicode字符；或者将JS文件设置成UTF-8编码，然后在加载JS的script标签中设置编码(`charset="utf-8"`)。不要诧异为什么要这么做，因为我们的HTML也页面设置的可能是GBK编码。

##### 2.Ajax请求乱码问题

当我们使用Ajax请求数据时，如果用post方法，不管页面编码是GBK,还是UTF-8,`send(data)`方法中data数据都将会被转换成[**encoding:utf-8**](http://www.w3.org/TR/XMLHttpRequest/#the-send%28%29-method),所以对于GBK编码的页面，在post数据时，必须对编码进行转换，否则就可能会出现乱码(可以利用Javascript提供的那三种编码转换方法)。下面看一下W3规定xhr send(data)时，如何处理data数据的：

> If `data` is null, do not include a request entity body and go to the next step.
> Otherwise, let encoding be null, mime type be null, and then follow these rules, depending on data:
> 
> ... ...
> 
> **a string**
> **Let encoding be "UTF-8".**
> **Let mime type be "text/plain;charset=UTF-8".**
> **Let the request entity body be data, utf-8 encoded.**
