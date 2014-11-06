### 内存管理

目前Objective-C推荐使用 **ARC(自动引用计数)** 进行内存管理，但是之前的Objective-C则采用的是 **自动释放和手动引用计数** 进行内存管理，所以需要搞清楚两者的区别。

##### 自动释放和手动引用计数

在手动引用计数时，申请内存后`alloc`,引用对象需要手动的设置`retain` +1 或者`release` -1 方法，来改变对象的引用计数值，当计数为0时，系统底层会调用`dealloc`释放掉内存；

当然也可以利用自动释放池管理内存，自动释放池可以自动释放对象，但是并不是所有新创建的对象都会被自动释放，如果是以 *alloc,copy,mutableCopy,new* 方法为前缀创建的对象，则一样像上面一些样手动管理内存，如下：

	@autoreasepool {
		NSString *str1,*str2;
		str1 = [NSString stringWithString:@"Hello World!"];//自动释放池管理
		str2 = [NSString init];//需要手工release
		/*
			手工处理方式如下代码
		*/
	}
	@aotorelesepool {
		/*
			省略部分代码
		*/
		str2 = [[NSString init] autorelase]//方法1
		[str2 release]//方法2
	}

自动释放池维护的可释放的对象，如果想保持不被回收，可以调用`retain`方法(初始化时直接调用如`str1 = [[NSString stringWithString:@"Hello World!"] retain]`或者其他地方调用)

##### ARC-自动引用计数

**采用ARC编译时** 自动释放池中的所有对象会被系统自动维护处理，不在引用的将会被销毁，方便了开发。

##### 定义类时两种内存管理中的属性声明的不同表现

内存管理模式不同，类的属性声明也就不同：

在手动自动释放池模式中，`@property`可以声明`assign,retain,copy`选项，`assign`是默认。

* `assign`默认选项：直接赋值，不改变引用计数值，适用于基本的数据类型，如init,float,char等，如果用于指向对象，则容易造成**内存泄露**，这时当重新赋值时，就需要手动的对之前的引用释放内存，或者在自动释放池结束后手动的释放 -- 参见上面 **自动释放和手动引用计数**
* `retain`：释放之前对象的引用，并指向新的引用对象，新的引用对象的引用计数加1
* `copy`：和`retain`相似,但是没有增加新的引用对象的计数，而是重新分配了新的内存，适用于**复制**

关于`retain,copy`修饰属性选项，实例化对象时，给属性设置`obj.property = newValue`，实际上相当于内部执行了以下代码：

	if(property != newValue){//retain
		[property release];
		property = [newValue retain];
	}
	if(property != newValue){//copy
		[property release];
		property = [newValue copy];
	}

手动引用计数模式下，当某对象的引用不在需要时，除了手动设置`release`外，也可以重写`dealloc`方法，将所有不需要的对象释放掉，当然别忘记了调用`[super dealloc]`。

而ARC中，引用`unsafe_unretained,weak,strong`这些选项,`unsafe_unretained`相当于上面的`assign`,`strong`相当于`retain`,而`weak`与`assign`的区别就是当对象消失时，`weak`将对象指针设为`nil`。

### 属性声明

接口文件中`@property`和实现文件中`@sythesize`用于声明属性并自动生成设值和取值方法(*`@synthesize`非必须，但是如果没有声明则生成的实体变量会以_为前缀*）。属性`@property`的选项，可以包含以下选项以name为例：

	@property(assign默认/retain/copy,getter=name,setting=setName,atonic默认/nonatomic,readwrite默认/readonly) NSString name;

具体含义参见 **#内存管理**。

### 对象复制

一般对于Foundation对象，可以直接调用`copy`或`mutableCopy`进行复制，而自定义对象需要在定义类时，实现`<NSCopying>`协议，在实现中定义`copyWithZone`方法，在执行程序中通过调用`copy`方法，来实现简单的复制。但是对于复杂的涉及到可修改的对象时，需要考虑是 **深度复制** 还是 **浅复制**，这种情况下如果要实现深度复制，可以通过归档的方式来处理，同理自定义归档的类，需要实现`<NSCoding>`协议实现`encodeWithCoder,initWithCoder`方法，将数据编码归档，解码传递给`NSData`对象，并最终复制给新的引用，从而实现深度复制。

### 一些声明/关键字

SEL,@selector

##### const,static,extern

* `const`: 比较好理解，就是不可修改的变量，但是如果变量指向一个对象，而且对象是mutable对象时，则对象里面的引用是可以修改的。
* `static`: 只能用于文件，函数或者类中特定作用域的变量，static只允许拥有一份，如果在类中声明为属性，则所有的实例对象将指向同一值；如果在函数中声明static变量，如果变量值在函数执行过程中改变，再次调用这个函数时，将会使用改变后的值（这点有点类似于JS中的闭包）。
* `extern`: 在函数或者方法外声明的变量如`int gVar = 1`，这个变量既是全局变量也是外部变量，但是如果其他文件像读取这个 **全局外部变量**，必须在其文件前面加上声明`extern`,如`extern int gVar`，这样就可以使用了。

##### public,protected,private

故名思议，public全局的方法或者属性，protected可以被继承，private不可继承。

##### enum,tydef,#define

* `typedef`:用于替换数据类型
* `enum`: 声明枚举对象 enum season {spring,summer,autumn,winter}

两者联合起来可以这么用:

	typedef enum {
		spring,summer,autumn,winter
	} season;

* `#define`:用于将某一变量指定为某一值或者函数如：

	#define PI 3.14
	#define SQUARE(x) X*X
	init y = SQUARE(2);
	
##### @class,#import

当新的类需要引用某一其他类时，通用的方法是通过`#import`引入这个类的头文件，这时被引用类的所有方法都会被导入进来，如果多个文件引用同意类，通过`#import`将会被多次导入，这样的话编译效率可想而知，但是可以通过`@class`声明的方式声明需要引用的类，当程序需要调用引入类的方法或属性时在调用。

##### SEL,@selector

Objective-C的类不能像C一样直接应用函数指针，通过SEL声明一变量为方法指针，通过@selector(method)获取method方法的指针，如下：

	//C函数指针
	int num(int i)
	{
		return i;
	}
	int *p_num(int val);
	p_num = num;
	
	//通过@selector设置函数指针
	@interface foo
	- int num:int i;
	@end
	SEL class_func ; //定义一个类方法指针  
	class_func = @selector(num:int);
	
可以通过调用指针函数`class_func`来执行指针所指向的函数（我们也可以改变指针所指向的函数)，调用方法`[obj performSelector:class_func]`。
	
##### 其他

* `self`：相当于this
* `id`：表示任何类型
* `instancetype` 重载内置init方法的声明,如：

```
	(instancetype) init{
		self = [self init];
		if(self){
		}
		return self;
	}
```

### 分类

分类(Category)可以给已存在或者定义的对象添加属性或者方法,如:

```
@interface NSString(Utilities)
	- NSString *someMethod:(NSString *) str;
@end
```


	

