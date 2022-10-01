
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function setContext(key, context) {
        get_current_component().$$.context.set(key, context);
        return context;
    }
    function getContext(key) {
        return get_current_component().$$.context.get(key);
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            // @ts-ignore
            callbacks.slice().forEach(fn => fn.call(this, event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.50.1' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    /* node_modules/@specialdoom/proi-ui/avatar/Avatar.svelte generated by Svelte v3.50.1 */

    const file$b = "node_modules/@specialdoom/proi-ui/avatar/Avatar.svelte";

    // (15:2) {#if initials !== "" && image === ""}
    function create_if_block$3(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text(/*initials*/ ctx[0]);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*initials*/ 1) set_data_dev(t, /*initials*/ ctx[0]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(15:2) {#if initials !== \\\"\\\" && image === \\\"\\\"}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$c(ctx) {
    	let div;
    	let div_class_value;
    	let if_block = /*initials*/ ctx[0] !== "" && /*image*/ ctx[2] === "" && create_if_block$3(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (if_block) if_block.c();
    			attr_dev(div, "class", div_class_value = "proi-avatar data-display " + /*variant*/ ctx[1] + " svelte-1q88d3s");
    			attr_dev(div, "style", /*style*/ ctx[3]);
    			attr_dev(div, "data-testid", "proi-avatar");
    			add_location(div, file$b, 9, 0, 221);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if (if_block) if_block.m(div, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*initials*/ ctx[0] !== "" && /*image*/ ctx[2] === "") {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$3(ctx);
    					if_block.c();
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*variant*/ 2 && div_class_value !== (div_class_value = "proi-avatar data-display " + /*variant*/ ctx[1] + " svelte-1q88d3s")) {
    				attr_dev(div, "class", div_class_value);
    			}

    			if (dirty & /*style*/ 8) {
    				attr_dev(div, "style", /*style*/ ctx[3]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$c.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$c($$self, $$props, $$invalidate) {
    	let style;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Avatar', slots, []);
    	let { initials = "" } = $$props;
    	let { variant = "pine" } = $$props;
    	let { image = "" } = $$props;
    	const writable_props = ['initials', 'variant', 'image'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Avatar> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('initials' in $$props) $$invalidate(0, initials = $$props.initials);
    		if ('variant' in $$props) $$invalidate(1, variant = $$props.variant);
    		if ('image' in $$props) $$invalidate(2, image = $$props.image);
    	};

    	$$self.$capture_state = () => ({ initials, variant, image, style });

    	$$self.$inject_state = $$props => {
    		if ('initials' in $$props) $$invalidate(0, initials = $$props.initials);
    		if ('variant' in $$props) $$invalidate(1, variant = $$props.variant);
    		if ('image' in $$props) $$invalidate(2, image = $$props.image);
    		if ('style' in $$props) $$invalidate(3, style = $$props.style);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*image*/ 4) {
    			$$invalidate(3, style = image !== ""
    			? `background: url(${image}) center center/50px 50px no-repeat;`
    			: "");
    		}
    	};

    	return [initials, variant, image, style];
    }

    class Avatar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$c, create_fragment$c, safe_not_equal, { initials: 0, variant: 1, image: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Avatar",
    			options,
    			id: create_fragment$c.name
    		});
    	}

    	get initials() {
    		throw new Error("<Avatar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set initials(value) {
    		throw new Error("<Avatar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get variant() {
    		throw new Error("<Avatar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set variant(value) {
    		throw new Error("<Avatar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get image() {
    		throw new Error("<Avatar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set image(value) {
    		throw new Error("<Avatar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules/@specialdoom/proi-ui/avatar/defaults/Leo.svelte generated by Svelte v3.50.1 */

    const file$a = "node_modules/@specialdoom/proi-ui/avatar/defaults/Leo.svelte";

    function create_fragment$b(ctx) {
    	let svg;
    	let path0;
    	let path1;
    	let path2;
    	let path3;
    	let path4;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			path2 = svg_element("path");
    			path3 = svg_element("path");
    			path4 = svg_element("path");
    			attr_dev(path0, "d", "M28.9836 50.5836C39.5875 50.5836 48.1836 41.9875 48.1836 31.3836C48.1836 20.7797 39.5875 12.1836 28.9836 12.1836C18.3798 12.1836 9.78363 20.7797 9.78363 31.3836C9.78363 41.9875 18.3798 50.5836 28.9836 50.5836Z");
    			attr_dev(path0, "fill", "#357266");
    			attr_dev(path0, "stroke", "#357266");
    			add_location(path0, file$a, 9, 2, 172);
    			attr_dev(path1, "d", "M45.84 20.04L53.76 8.63999L47.04 11.16L37.08 5.75999L9.6 13.08L6.12 30L11.52 33.84L17.28 31.68L22.68 20.64L45.84 20.04Z");
    			attr_dev(path1, "fill", "#2178C0");
    			attr_dev(path1, "stroke", "#2178C0");
    			add_location(path1, file$a, 14, 2, 448);
    			attr_dev(path2, "d", "M29.9988 32.4C29.1036 32.4 28.422 32.1468 27.918 31.6272C27.1248 30.8088 26.8044 29.3736 26.8788 26.9736C26.8934 26.5097 27.2813 26.1454 27.7452 26.16C28.2091 26.1746 28.5734 26.5625 28.5588 27.0264C28.4868 29.3064 28.8276 30.1464 29.1252 30.4584C29.2452 30.588 29.4528 30.72 29.9988 30.72C30.1571 30.7217 30.3078 30.6521 30.4092 30.5304C30.7944 30.1272 31.1736 28.998 31.08 27.0396C31.0581 26.5757 31.4165 26.1819 31.8804 26.16C32.3443 26.1381 32.7381 26.4965 32.76 26.9604C32.82 28.2204 32.7528 30.51 31.6272 31.6896C31.2081 32.1443 30.6172 32.4021 29.9988 32.4Z");
    			attr_dev(path2, "fill", "#223843");
    			attr_dev(path2, "stroke", "#223843");
    			attr_dev(path2, "stroke-linecap", "round");
    			add_location(path2, file$a, 19, 2, 634);
    			attr_dev(path3, "d", "M41.8788 32.4C40.9836 32.4 40.302 32.1468 39.798 31.6272C39.0048 30.8088 38.6844 29.3736 38.7588 26.9736C38.7734 26.5097 39.1613 26.1454 39.6252 26.16C40.0891 26.1746 40.4534 26.5625 40.4388 27.0264C40.3668 29.3064 40.7076 30.1464 41.0052 30.4584C41.1252 30.588 41.3328 30.72 41.8788 30.72C42.0371 30.7217 42.1879 30.6521 42.2892 30.5304C42.6744 30.1272 43.0536 28.998 42.96 27.0396C42.9381 26.5757 43.2965 26.1819 43.7604 26.16C44.2243 26.1381 44.6181 26.4965 44.64 26.9604C44.7 28.2204 44.6328 30.51 43.5072 31.6896C43.0881 32.1443 42.4972 32.4021 41.8788 32.4Z");
    			attr_dev(path3, "fill", "#223843");
    			attr_dev(path3, "stroke", "#223843");
    			attr_dev(path3, "stroke-linecap", "round");
    			add_location(path3, file$a, 25, 2, 1293);
    			attr_dev(path4, "d", "M37.92 40.89H31.08C29.7048 40.89 28.59 39.7752 28.59 38.4C28.59 37.0248 29.7048 35.91 31.08 35.91H37.92C39.2952 35.91 40.41 37.0248 40.41 38.4C40.41 39.7752 39.2952 40.89 37.92 40.89ZM31.08 37.65C30.6658 37.65 30.33 37.9858 30.33 38.4C30.33 38.8142 30.6658 39.15 31.08 39.15H37.92C38.3342 39.15 38.67 38.8142 38.67 38.4C38.67 37.9858 38.3342 37.65 37.92 37.65H31.08Z");
    			attr_dev(path4, "fill", "#EFF1F3");
    			attr_dev(path4, "stroke", "#EFF1F3");
    			attr_dev(path4, "stroke-linecap", "round");
    			add_location(path4, file$a, 31, 2, 1951);
    			attr_dev(svg, "width", "60");
    			attr_dev(svg, "height", "60");
    			attr_dev(svg, "viewBox", "0 0 60 60");
    			attr_dev(svg, "fill", "none");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "data-testid", "proi-default-avatar");
    			attr_dev(svg, "data-name", "leo");
    			add_location(svg, file$a, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path0);
    			append_dev(svg, path1);
    			append_dev(svg, path2);
    			append_dev(svg, path3);
    			append_dev(svg, path4);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$b($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Leo', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Leo> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Leo extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Leo",
    			options,
    			id: create_fragment$b.name
    		});
    	}
    }

    /* node_modules/@specialdoom/proi-ui/avatar/defaults/Lauren.svelte generated by Svelte v3.50.1 */

    const file$9 = "node_modules/@specialdoom/proi-ui/avatar/defaults/Lauren.svelte";

    function create_fragment$a(ctx) {
    	let svg;
    	let path0;
    	let path1;
    	let path2;
    	let path3;
    	let path4;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			path2 = svg_element("path");
    			path3 = svg_element("path");
    			path4 = svg_element("path");
    			attr_dev(path0, "d", "M30 52.6164C41.1652 52.6164 50.2164 43.5652 50.2164 32.4C50.2164 21.2348 41.1652 12.1836 30 12.1836C18.8348 12.1836 9.78357 21.2348 9.78357 32.4C9.78357 43.5652 18.8348 52.6164 30 52.6164Z");
    			attr_dev(path0, "fill", "#690375");
    			attr_dev(path0, "stroke", "#690375");
    			add_location(path0, file$9, 9, 2, 175);
    			attr_dev(path1, "d", "M51.72 24.36H37.4592L35.04 18.36V24.36H18.36C13.6428 34.4964 17.3196 48.24 18.6492 52.4688C18.7037 52.6435 18.6388 52.8334 18.4887 52.9381C18.3387 53.0429 18.1381 53.0385 17.9928 52.9272L5.76003 43.56C5.76003 43.56 4.32003 17.04 8.88003 12.6C14.9016 6.73679 28.062 6.83999 34.32 6.83999C42.24 6.83999 49.3884 8.66639 50.16 9.83999C52.92 14.04 51.72 24.36 51.72 24.36Z");
    			attr_dev(path1, "fill", "#C39AC8");
    			attr_dev(path1, "stroke", "#C39AC8");
    			attr_dev(path1, "stroke-linecap", "round");
    			add_location(path1, file$9, 14, 2, 430);
    			attr_dev(path2, "d", "M32.7216 30.8712C32.3549 30.8712 32.0276 30.6413 31.9032 30.2964C31.404 28.9152 31.0068 28.7676 31.0032 28.7676C30.7776 28.7856 30.1824 29.5284 29.8428 30.3372C29.6576 30.7806 29.148 30.9898 28.7046 30.8046C28.2612 30.6194 28.052 30.1098 28.2372 29.6664C28.422 29.2236 29.418 27.0264 31.0068 27.0264H31.0488C32.586 27.0636 33.3036 29.0508 33.54 29.7048C33.6362 29.9714 33.5965 30.2681 33.4336 30.5C33.2707 30.732 33.005 30.87 32.7216 30.87V30.8712Z");
    			attr_dev(path2, "fill", "#A8D0F0");
    			attr_dev(path2, "stroke", "#A8D0F0");
    			attr_dev(path2, "stroke-linecap", "round");
    			add_location(path2, file$9, 20, 2, 892);
    			attr_dev(path3, "d", "M44.16 30.8712C43.7934 30.8712 43.466 30.6413 43.3416 30.2964C42.8424 28.9152 42.4452 28.7676 42.4416 28.7676C42.216 28.7856 41.6208 29.5284 41.2812 30.3372C41.096 30.7806 40.5864 30.9898 40.143 30.8046C39.6997 30.6194 39.4904 30.1098 39.6756 29.6664C39.8604 29.2224 40.8564 27.0264 42.4452 27.0264H42.4872C44.0244 27.0636 44.742 29.0508 44.9784 29.7048C45.0746 29.9714 45.0349 30.2681 44.872 30.5C44.7091 30.732 44.4434 30.87 44.16 30.87V30.8712Z");
    			attr_dev(path3, "fill", "#A8D0F0");
    			attr_dev(path3, "stroke", "#A8D0F0");
    			attr_dev(path3, "stroke-linecap", "round");
    			add_location(path3, file$9, 26, 2, 1435);
    			attr_dev(path4, "d", "M40.05 43.86H31.95C30.7737 43.8587 29.8207 42.9051 29.82 41.7288V41.22C29.82 40.7561 30.1961 40.38 30.66 40.38C31.1239 40.38 31.5 40.7561 31.5 41.22V41.7288C31.4997 41.8484 31.547 41.9631 31.6314 42.0478C31.7158 42.1324 31.8305 42.18 31.95 42.18H40.05C40.1696 42.18 40.2842 42.1324 40.3686 42.0478C40.4531 41.9631 40.5003 41.8484 40.5 41.7288V41.22C40.5 40.7561 40.8761 40.38 41.34 40.38C41.8039 40.38 42.18 40.7561 42.18 41.22V41.7288C42.1793 42.9051 41.2263 43.8587 40.05 43.86Z");
    			attr_dev(path4, "fill", "#A8D0F0");
    			attr_dev(path4, "stroke", "#A8D0F0");
    			attr_dev(path4, "stroke-linecap", "round");
    			add_location(path4, file$9, 32, 2, 1977);
    			attr_dev(svg, "width", "60");
    			attr_dev(svg, "height", "60");
    			attr_dev(svg, "viewBox", "0 0 60 60");
    			attr_dev(svg, "fill", "none");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "data-testid", "proi-default-avatar");
    			attr_dev(svg, "data-name", "lauren");
    			add_location(svg, file$9, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path0);
    			append_dev(svg, path1);
    			append_dev(svg, path2);
    			append_dev(svg, path3);
    			append_dev(svg, path4);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Lauren', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Lauren> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Lauren extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Lauren",
    			options,
    			id: create_fragment$a.name
    		});
    	}
    }

    /* node_modules/@specialdoom/proi-ui/avatar/defaults/Tim.svelte generated by Svelte v3.50.1 */

    const file$8 = "node_modules/@specialdoom/proi-ui/avatar/defaults/Tim.svelte";

    function create_fragment$9(ctx) {
    	let svg;
    	let path0;
    	let path1;
    	let path2;
    	let path3;
    	let path4;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			path2 = svg_element("path");
    			path3 = svg_element("path");
    			path4 = svg_element("path");
    			attr_dev(path0, "d", "M30 52.6164C41.1652 52.6164 50.2164 43.5652 50.2164 32.4C50.2164 21.2348 41.1652 12.1836 30 12.1836C18.8348 12.1836 9.78357 21.2348 9.78357 32.4C9.78357 43.5652 18.8348 52.6164 30 52.6164Z");
    			attr_dev(path0, "fill", "#FFC1AE");
    			attr_dev(path0, "stroke", "#FFC1AE");
    			add_location(path0, file$8, 9, 2, 172);
    			attr_dev(path1, "d", "M10.2 13.1172V28.6716L39.36 19.32L50.16 27.6492L48.3432 11.5296L10.2 13.1172Z");
    			attr_dev(path1, "fill", "#FFC71F");
    			attr_dev(path1, "stroke", "#FFC71F");
    			add_location(path1, file$8, 14, 2, 427);
    			attr_dev(path2, "d", "M30.2148 32.5932C28.7848 32.5932 27.4957 31.7317 26.9486 30.4106C26.4015 29.0894 26.7042 27.5688 27.7155 26.5578C28.7268 25.5468 30.2475 25.2447 31.5685 25.7922C32.8895 26.3398 33.7505 27.6292 33.75 29.0592C33.7474 31.0103 32.166 32.5912 30.2148 32.5932ZM30.2148 27.204C29.1902 27.204 28.3596 28.0346 28.3596 29.0592C28.3596 30.0838 29.1902 30.9144 30.2148 30.9144C31.2394 30.9144 32.07 30.0838 32.07 29.0592C32.0687 28.0351 31.2389 27.2053 30.2148 27.204V27.204Z");
    			attr_dev(path2, "fill", "#2178C0");
    			attr_dev(path2, "stroke", "#2178C0");
    			attr_dev(path2, "stroke-linecap", "round");
    			add_location(path2, file$8, 19, 2, 571);
    			attr_dev(path3, "d", "M42.9852 32.5932C41.5552 32.5932 40.2661 31.7317 39.719 30.4106C39.1719 29.0894 39.4745 27.5688 40.4859 26.5578C41.4972 25.5468 43.0179 25.2447 44.3389 25.7922C45.6599 26.3398 46.5209 27.6292 46.5204 29.0592C46.5178 31.0103 44.9363 32.5912 42.9852 32.5932ZM42.9852 27.204C41.9606 27.204 41.13 28.0346 41.13 29.0592C41.13 30.0838 41.9606 30.9144 42.9852 30.9144C44.0098 30.9144 44.8404 30.0838 44.8404 29.0592C44.8391 28.0351 44.0092 27.2053 42.9852 27.204V27.204Z");
    			attr_dev(path3, "fill", "#2178C0");
    			attr_dev(path3, "stroke", "#2178C0");
    			attr_dev(path3, "stroke-linecap", "round");
    			add_location(path3, file$8, 25, 2, 1129);
    			attr_dev(path4, "d", "M35.3112 41.958C35.2265 41.9578 35.1419 41.9518 35.058 41.94C32.88 41.6208 32.9544 38.1084 32.9916 37.4076C33.007 37.0965 33.1874 36.8174 33.4648 36.6757C33.7422 36.534 34.0741 36.5515 34.3352 36.7214C34.5962 36.8913 34.7465 37.1878 34.7292 37.4988C34.6608 38.8464 34.9992 40.1724 35.31 40.218C35.6772 40.1844 36.564 38.754 37.068 37.1328C37.2105 36.6738 37.698 36.4173 38.157 36.5598C38.6159 36.7023 38.8725 37.1898 38.73 37.6488C38.4084 38.6868 37.2384 41.958 35.3112 41.958Z");
    			attr_dev(path4, "fill", "#62AAE4");
    			attr_dev(path4, "stroke", "#62AAE4");
    			attr_dev(path4, "stroke-linecap", "round");
    			add_location(path4, file$8, 31, 2, 1687);
    			attr_dev(svg, "width", "60");
    			attr_dev(svg, "height", "60");
    			attr_dev(svg, "viewBox", "0 0 60 60");
    			attr_dev(svg, "fill", "none");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "data-testid", "proi-default-avatar");
    			attr_dev(svg, "data-name", "tim");
    			add_location(svg, file$8, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path0);
    			append_dev(svg, path1);
    			append_dev(svg, path2);
    			append_dev(svg, path3);
    			append_dev(svg, path4);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Tim', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Tim> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Tim extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Tim",
    			options,
    			id: create_fragment$9.name
    		});
    	}
    }

    /* node_modules/@specialdoom/proi-ui/avatar/defaults/Nikita.svelte generated by Svelte v3.50.1 */

    const file$7 = "node_modules/@specialdoom/proi-ui/avatar/defaults/Nikita.svelte";

    function create_fragment$8(ctx) {
    	let svg;
    	let path0;
    	let path1;
    	let path2;
    	let path3;
    	let path4;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			path2 = svg_element("path");
    			path3 = svg_element("path");
    			path4 = svg_element("path");
    			attr_dev(path0, "d", "M38.28 50.16L21.48 45.48L16.56 38.52L11.5344 35.04V16.2H48.4656V41.88L38.28 50.16Z");
    			attr_dev(path0, "fill", "#3993DD");
    			attr_dev(path0, "stroke", "#3993DD");
    			add_location(path0, file$7, 9, 2, 175);
    			attr_dev(path1, "d", "M39.48 17.88C39.48 17.88 39.84 22.44 32.28 22.8C22.2 23.28 19.44 30.96 19.32 36.48C19.2 42 19.08 48 14.64 49.8C10.2 51.6 4.80959 48.3156 4.43999 45.36C3.23999 35.76 3.21599 17.4624 9.83999 12.24C16.08 7.32 27.6 7.44 35.88 9.12C41.172 10.2 39.48 17.88 39.48 17.88Z");
    			attr_dev(path1, "fill", "#FFDB70");
    			attr_dev(path1, "stroke", "#FFDB70");
    			attr_dev(path1, "stroke-linecap", "round");
    			add_location(path1, file$7, 14, 2, 324);
    			attr_dev(path2, "d", "M34.32 29.64C34.1268 29.7669 33.9218 29.875 33.708 29.9628C33.5053 30.0496 33.2978 30.1245 33.0864 30.1872C32.6767 30.3073 32.2563 30.3876 31.8312 30.4272C30.9895 30.5094 30.1399 30.446 29.3196 30.24C28.8982 30.1361 28.4882 29.9905 28.0956 29.8056C27.6848 29.6147 27.2998 29.3728 26.9496 29.0856C26.5781 28.7895 26.262 28.43 26.016 28.0236C25.9596 27.9132 25.896 27.8124 25.8516 27.6996C25.8057 27.5874 25.7657 27.4728 25.7316 27.3564C25.7036 27.2377 25.6824 27.1175 25.668 26.9964C25.662 26.8763 25.6656 26.7559 25.6788 26.6364C25.7928 26.6892 25.8912 26.742 25.986 26.7888L26.2752 26.9088L26.5536 27.0036C26.6436 27.0324 26.736 27.0588 26.8236 27.0828C27.1836 27.1788 27.522 27.2496 27.864 27.3228L28.8948 27.5412C29.2392 27.618 29.5872 27.6996 29.9388 27.7884C30.667 27.9701 31.3835 28.1957 32.0844 28.464C32.4597 28.6088 32.8274 28.7726 33.186 28.9548C33.372 29.0508 33.5592 29.1492 33.7464 29.2608C33.9443 29.3768 34.1358 29.5034 34.32 29.64Z");
    			attr_dev(path2, "fill", "#EFF1F3");
    			attr_dev(path2, "stroke", "#EFF1F3");
    			attr_dev(path2, "stroke-linecap", "round");
    			add_location(path2, file$7, 20, 2, 682);
    			attr_dev(path3, "d", "M38.16 29.64C38.3439 29.505 38.535 29.3801 38.7324 29.2656C38.9196 29.154 39.1068 29.0556 39.2928 28.9596C39.6514 28.7774 40.0191 28.6136 40.3944 28.4688C41.0953 28.2005 41.8118 27.9748 42.54 27.7932C42.8916 27.7044 43.2396 27.6228 43.584 27.546L44.6148 27.3276C44.9568 27.2532 45.3 27.1824 45.6552 27.0876C45.7428 27.0636 45.8352 27.0372 45.9252 27.0084L46.2036 26.9136L46.4928 26.7936C46.5876 26.7468 46.686 26.694 46.8 26.6412C46.8132 26.7607 46.8168 26.8811 46.8108 27.0012C46.7964 27.1223 46.7752 27.2425 46.7472 27.3612C46.7131 27.4776 46.673 27.5921 46.6272 27.7044C46.5804 27.8172 46.5192 27.918 46.4628 28.0284C46.2167 28.4348 45.9007 28.7943 45.5292 29.0904C45.179 29.3776 44.7939 29.6195 44.3832 29.8104C43.9905 29.9953 43.5805 30.1408 43.1592 30.2448C42.3393 30.4532 41.4897 30.519 40.6476 30.4392C40.2224 30.3996 39.8021 30.3193 39.3924 30.1992C39.181 30.1365 38.9734 30.0616 38.7708 29.9748C38.5569 29.8831 38.3523 29.771 38.16 29.64Z");
    			attr_dev(path3, "fill", "#EFF1F3");
    			attr_dev(path3, "stroke", "#EFF1F3");
    			attr_dev(path3, "stroke-linecap", "round");
    			add_location(path3, file$7, 26, 2, 1724);
    			attr_dev(path4, "d", "M45 38C42.1667 42.1667 34.5 47.8 26.5 37M29 36.5C27.8333 36.1667 25.5 36.3 25.5 39.5");
    			attr_dev(path4, "stroke", "#223843");
    			attr_dev(path4, "stroke-width", "2");
    			attr_dev(path4, "stroke-linecap", "round");
    			add_location(path4, file$7, 32, 2, 2767);
    			attr_dev(svg, "width", "60");
    			attr_dev(svg, "height", "60");
    			attr_dev(svg, "viewBox", "0 0 60 60");
    			attr_dev(svg, "fill", "none");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "data-testid", "proi-default-avatar");
    			attr_dev(svg, "data-name", "nikita");
    			add_location(svg, file$7, 0, 0, 0);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path0);
    			append_dev(svg, path1);
    			append_dev(svg, path2);
    			append_dev(svg, path3);
    			append_dev(svg, path4);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Nikita', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Nikita> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Nikita extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Nikita",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    Object.assign(Avatar, {
        Leo,
        Nikita,
        Lauren,
        Tim
    });

    /* node_modules/@specialdoom/proi-ui/button/Button.svelte generated by Svelte v3.50.1 */

    const file$6 = "node_modules/@specialdoom/proi-ui/button/Button.svelte";

    function create_fragment$7(ctx) {
    	let button;
    	let button_class_value;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[5].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[4], null);

    	const block_1 = {
    		c: function create() {
    			button = element("button");
    			if (default_slot) default_slot.c();
    			attr_dev(button, "class", button_class_value = "proi-button " + /*variant*/ ctx[0] + " " + /*className*/ ctx[3] + " svelte-p68yoy");
    			button.disabled = /*disabled*/ ctx[1];
    			attr_dev(button, "data-testid", "proi-button");
    			toggle_class(button, "block", /*block*/ ctx[2]);
    			add_location(button, file$6, 6, 0, 139);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (default_slot) {
    				default_slot.m(button, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[6], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 16)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[4],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[4])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[4], dirty, null),
    						null
    					);
    				}
    			}

    			if (!current || dirty & /*variant, className*/ 9 && button_class_value !== (button_class_value = "proi-button " + /*variant*/ ctx[0] + " " + /*className*/ ctx[3] + " svelte-p68yoy")) {
    				attr_dev(button, "class", button_class_value);
    			}

    			if (!current || dirty & /*disabled*/ 2) {
    				prop_dev(button, "disabled", /*disabled*/ ctx[1]);
    			}

    			if (!current || dirty & /*variant, className, block*/ 13) {
    				toggle_class(button, "block", /*block*/ ctx[2]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block: block_1,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block_1;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Button', slots, ['default']);
    	let { variant = "primary" } = $$props;
    	let { disabled = false } = $$props;
    	let { block = false } = $$props;
    	let { className = "" } = $$props;
    	const writable_props = ['variant', 'disabled', 'block', 'className'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Button> was created with unknown prop '${key}'`);
    	});

    	function click_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	$$self.$$set = $$props => {
    		if ('variant' in $$props) $$invalidate(0, variant = $$props.variant);
    		if ('disabled' in $$props) $$invalidate(1, disabled = $$props.disabled);
    		if ('block' in $$props) $$invalidate(2, block = $$props.block);
    		if ('className' in $$props) $$invalidate(3, className = $$props.className);
    		if ('$$scope' in $$props) $$invalidate(4, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ variant, disabled, block, className });

    	$$self.$inject_state = $$props => {
    		if ('variant' in $$props) $$invalidate(0, variant = $$props.variant);
    		if ('disabled' in $$props) $$invalidate(1, disabled = $$props.disabled);
    		if ('block' in $$props) $$invalidate(2, block = $$props.block);
    		if ('className' in $$props) $$invalidate(3, className = $$props.className);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [variant, disabled, block, className, $$scope, slots, click_handler];
    }

    class Button extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {
    			variant: 0,
    			disabled: 1,
    			block: 2,
    			className: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Button",
    			options,
    			id: create_fragment$7.name
    		});
    	}

    	get variant() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set variant(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get disabled() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set disabled(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get block() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set block(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get className() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set className(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules/@specialdoom/proi-ui/form-item/FormItem.svelte generated by Svelte v3.50.1 */

    const file$5 = "node_modules/@specialdoom/proi-ui/form-item/FormItem.svelte";

    // (10:2) {#if description !== ""}
    function create_if_block_1$1(ctx) {
    	let span;
    	let t;

    	const block = {
    		c: function create() {
    			span = element("span");
    			t = text(/*description*/ ctx[1]);
    			attr_dev(span, "class", "proi-description svelte-j3uth4");
    			add_location(span, file$5, 10, 4, 278);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			append_dev(span, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*description*/ 2) set_data_dev(t, /*description*/ ctx[1]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(10:2) {#if description !== \\\"\\\"}",
    		ctx
    	});

    	return block;
    }

    // (16:2) {#if error !== ""}
    function create_if_block$2(ctx) {
    	let span;
    	let t;

    	const block = {
    		c: function create() {
    			span = element("span");
    			t = text(/*error*/ ctx[2]);
    			attr_dev(span, "class", "proi-error svelte-j3uth4");
    			add_location(span, file$5, 16, 4, 392);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			append_dev(span, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*error*/ 4) set_data_dev(t, /*error*/ ctx[2]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(16:2) {#if error !== \\\"\\\"}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let div;
    	let span;
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let current;
    	let if_block0 = /*description*/ ctx[1] !== "" && create_if_block_1$1(ctx);
    	const default_slot_template = /*#slots*/ ctx[4].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], null);
    	let if_block1 = /*error*/ ctx[2] !== "" && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			span = element("span");
    			t0 = text(/*label*/ ctx[0]);
    			t1 = space();
    			if (if_block0) if_block0.c();
    			t2 = space();
    			if (default_slot) default_slot.c();
    			t3 = space();
    			if (if_block1) if_block1.c();
    			attr_dev(span, "class", "proi-label svelte-j3uth4");
    			attr_dev(span, "data-testid", "proi-form-item-label");
    			add_location(span, file$5, 6, 2, 160);
    			attr_dev(div, "class", "proi-form-item svelte-j3uth4");
    			attr_dev(div, "data-testid", "proi-form-item");
    			add_location(div, file$5, 5, 0, 99);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, span);
    			append_dev(span, t0);
    			append_dev(div, t1);
    			if (if_block0) if_block0.m(div, null);
    			append_dev(div, t2);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			append_dev(div, t3);
    			if (if_block1) if_block1.m(div, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*label*/ 1) set_data_dev(t0, /*label*/ ctx[0]);

    			if (/*description*/ ctx[1] !== "") {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_1$1(ctx);
    					if_block0.c();
    					if_block0.m(div, t2);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 8)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[3],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[3])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[3], dirty, null),
    						null
    					);
    				}
    			}

    			if (/*error*/ ctx[2] !== "") {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block$2(ctx);
    					if_block1.c();
    					if_block1.m(div, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block0) if_block0.d();
    			if (default_slot) default_slot.d(detaching);
    			if (if_block1) if_block1.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('FormItem', slots, ['default']);
    	let { label = "" } = $$props;
    	let { description = "" } = $$props;
    	let { error = "" } = $$props;
    	const writable_props = ['label', 'description', 'error'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<FormItem> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('label' in $$props) $$invalidate(0, label = $$props.label);
    		if ('description' in $$props) $$invalidate(1, description = $$props.description);
    		if ('error' in $$props) $$invalidate(2, error = $$props.error);
    		if ('$$scope' in $$props) $$invalidate(3, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ label, description, error });

    	$$self.$inject_state = $$props => {
    		if ('label' in $$props) $$invalidate(0, label = $$props.label);
    		if ('description' in $$props) $$invalidate(1, description = $$props.description);
    		if ('error' in $$props) $$invalidate(2, error = $$props.error);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [label, description, error, $$scope, slots];
    }

    class FormItem extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, { label: 0, description: 1, error: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FormItem",
    			options,
    			id: create_fragment$6.name
    		});
    	}

    	get label() {
    		throw new Error("<FormItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set label(value) {
    		throw new Error("<FormItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get description() {
    		throw new Error("<FormItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set description(value) {
    		throw new Error("<FormItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get error() {
    		throw new Error("<FormItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set error(value) {
    		throw new Error("<FormItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const contextName = 'TABS';

    /* node_modules/@specialdoom/proi-ui/tabs/TabPane.svelte generated by Svelte v3.50.1 */

    // (10:0) {#if $current === index}
    function create_if_block$1(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[6].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[5], null);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 32)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[5],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[5])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[5], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(10:0) {#if $current === index}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*$current*/ ctx[1] === /*index*/ ctx[0] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*$current*/ ctx[1] === /*index*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*$current, index*/ 3) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let $current;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('TabPane', slots, ['default']);
    	let { title } = $$props;
    	let { index } = $$props;
    	let { disabled = false } = $$props;
    	const { registerPane, current } = getContext(contextName);
    	validate_store(current, 'current');
    	component_subscribe($$self, current, value => $$invalidate(1, $current = value));
    	registerPane({ title, index, disabled });
    	const writable_props = ['title', 'index', 'disabled'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<TabPane> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('title' in $$props) $$invalidate(3, title = $$props.title);
    		if ('index' in $$props) $$invalidate(0, index = $$props.index);
    		if ('disabled' in $$props) $$invalidate(4, disabled = $$props.disabled);
    		if ('$$scope' in $$props) $$invalidate(5, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		contextName,
    		title,
    		index,
    		disabled,
    		registerPane,
    		current,
    		$current
    	});

    	$$self.$inject_state = $$props => {
    		if ('title' in $$props) $$invalidate(3, title = $$props.title);
    		if ('index' in $$props) $$invalidate(0, index = $$props.index);
    		if ('disabled' in $$props) $$invalidate(4, disabled = $$props.disabled);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [index, $current, current, title, disabled, $$scope, slots];
    }

    class TabPane extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, { title: 3, index: 0, disabled: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TabPane",
    			options,
    			id: create_fragment$5.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*title*/ ctx[3] === undefined && !('title' in props)) {
    			console.warn("<TabPane> was created without expected prop 'title'");
    		}

    		if (/*index*/ ctx[0] === undefined && !('index' in props)) {
    			console.warn("<TabPane> was created without expected prop 'index'");
    		}
    	}

    	get title() {
    		throw new Error("<TabPane>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<TabPane>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get index() {
    		throw new Error("<TabPane>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set index(value) {
    		throw new Error("<TabPane>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get disabled() {
    		throw new Error("<TabPane>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set disabled(value) {
    		throw new Error("<TabPane>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules/@specialdoom/proi-ui/tabs/ScrollButton.svelte generated by Svelte v3.50.1 */

    const file$4 = "node_modules/@specialdoom/proi-ui/tabs/ScrollButton.svelte";

    // (5:0) {#if visible}
    function create_if_block(ctx) {
    	let div;
    	let t;
    	let mounted;
    	let dispose;
    	let if_block0 = /*direction*/ ctx[1] === "left" && create_if_block_2(ctx);
    	let if_block1 = /*direction*/ ctx[1] === "right" && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (if_block0) if_block0.c();
    			t = space();
    			if (if_block1) if_block1.c();
    			attr_dev(div, "class", "svelte-1u86lv6");
    			add_location(div, file$4, 5, 2, 90);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if (if_block0) if_block0.m(div, null);
    			append_dev(div, t);
    			if (if_block1) if_block1.m(div, null);

    			if (!mounted) {
    				dispose = listen_dev(div, "click", /*click_handler*/ ctx[2], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (/*direction*/ ctx[1] === "left") {
    				if (if_block0) ; else {
    					if_block0 = create_if_block_2(ctx);
    					if_block0.c();
    					if_block0.m(div, t);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*direction*/ ctx[1] === "right") {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_1(ctx);
    					if_block1.c();
    					if_block1.m(div, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(5:0) {#if visible}",
    		ctx
    	});

    	return block;
    }

    // (7:4) {#if direction === "left"}
    function create_if_block_2(ctx) {
    	let svg;
    	let path;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path = svg_element("path");
    			attr_dev(path, "d", "M7 1L1 7L7 13");
    			attr_dev(path, "stroke", "#33363F");
    			attr_dev(path, "stroke-width", "2");
    			attr_dev(path, "stroke-linecap", "round");
    			attr_dev(path, "stroke-linejoin", "round");
    			add_location(path, file$4, 14, 8, 300);
    			attr_dev(svg, "width", "8");
    			attr_dev(svg, "height", "14");
    			attr_dev(svg, "viewBox", "0 0 8 14");
    			attr_dev(svg, "fill", "none");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			add_location(svg, file$4, 7, 6, 144);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(7:4) {#if direction === \\\"left\\\"}",
    		ctx
    	});

    	return block;
    }

    // (24:4) {#if direction === "right"}
    function create_if_block_1(ctx) {
    	let svg;
    	let path;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path = svg_element("path");
    			attr_dev(path, "d", "M1 13L7 7L1 1");
    			attr_dev(path, "stroke", "#33363F");
    			attr_dev(path, "stroke-width", "2");
    			attr_dev(path, "stroke-linecap", "round");
    			attr_dev(path, "stroke-linejoin", "round");
    			add_location(path, file$4, 31, 8, 693);
    			attr_dev(svg, "width", "8");
    			attr_dev(svg, "height", "14");
    			attr_dev(svg, "viewBox", "0 0 8 14");
    			attr_dev(svg, "fill", "none");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			add_location(svg, file$4, 24, 6, 537);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, svg, anchor);
    			append_dev(svg, path);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(24:4) {#if direction === \\\"right\\\"}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let if_block_anchor;
    	let if_block = /*visible*/ ctx[0] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*visible*/ ctx[0]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ScrollButton', slots, []);
    	let { visible = false } = $$props;
    	let { direction } = $$props;
    	const writable_props = ['visible', 'direction'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ScrollButton> was created with unknown prop '${key}'`);
    	});

    	function click_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	$$self.$$set = $$props => {
    		if ('visible' in $$props) $$invalidate(0, visible = $$props.visible);
    		if ('direction' in $$props) $$invalidate(1, direction = $$props.direction);
    	};

    	$$self.$capture_state = () => ({ visible, direction });

    	$$self.$inject_state = $$props => {
    		if ('visible' in $$props) $$invalidate(0, visible = $$props.visible);
    		if ('direction' in $$props) $$invalidate(1, direction = $$props.direction);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [visible, direction, click_handler];
    }

    class ScrollButton extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { visible: 0, direction: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ScrollButton",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*direction*/ ctx[1] === undefined && !('direction' in props)) {
    			console.warn("<ScrollButton> was created without expected prop 'direction'");
    		}
    	}

    	get visible() {
    		throw new Error("<ScrollButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set visible(value) {
    		throw new Error("<ScrollButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get direction() {
    		throw new Error("<ScrollButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set direction(value) {
    		throw new Error("<ScrollButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules/@specialdoom/proi-ui/tabs/Tab.svelte generated by Svelte v3.50.1 */
    const file$3 = "node_modules/@specialdoom/proi-ui/tabs/Tab.svelte";

    function create_fragment$3(ctx) {
    	let button;
    	let t;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t = text(/*title*/ ctx[0]);
    			button.disabled = /*disabled*/ ctx[2];
    			attr_dev(button, "class", "svelte-1c505yx");
    			toggle_class(button, "selected", /*$current*/ ctx[4] === /*index*/ ctx[1]);
    			add_location(button, file$3, 15, 0, 396);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t);
    			/*button_binding*/ ctx[7](button);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*handleTabClick*/ ctx[6], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*title*/ 1) set_data_dev(t, /*title*/ ctx[0]);

    			if (dirty & /*disabled*/ 4) {
    				prop_dev(button, "disabled", /*disabled*/ ctx[2]);
    			}

    			if (dirty & /*$current, index*/ 18) {
    				toggle_class(button, "selected", /*$current*/ ctx[4] === /*index*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			/*button_binding*/ ctx[7](null);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let $current;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Tab', slots, []);
    	let { title } = $$props;
    	let { index } = $$props;
    	let { disabled = false } = $$props;
    	let tabElement;
    	const { current, selectTab } = getContext(contextName);
    	validate_store(current, 'current');
    	component_subscribe($$self, current, value => $$invalidate(4, $current = value));

    	function handleTabClick() {
    		if ($current === index) return;
    		tabElement.scrollIntoView(false);
    		selectTab(index);
    	}

    	const writable_props = ['title', 'index', 'disabled'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Tab> was created with unknown prop '${key}'`);
    	});

    	function button_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			tabElement = $$value;
    			$$invalidate(3, tabElement);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('title' in $$props) $$invalidate(0, title = $$props.title);
    		if ('index' in $$props) $$invalidate(1, index = $$props.index);
    		if ('disabled' in $$props) $$invalidate(2, disabled = $$props.disabled);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		contextName,
    		title,
    		index,
    		disabled,
    		tabElement,
    		current,
    		selectTab,
    		handleTabClick,
    		$current
    	});

    	$$self.$inject_state = $$props => {
    		if ('title' in $$props) $$invalidate(0, title = $$props.title);
    		if ('index' in $$props) $$invalidate(1, index = $$props.index);
    		if ('disabled' in $$props) $$invalidate(2, disabled = $$props.disabled);
    		if ('tabElement' in $$props) $$invalidate(3, tabElement = $$props.tabElement);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		title,
    		index,
    		disabled,
    		tabElement,
    		$current,
    		current,
    		handleTabClick,
    		button_binding
    	];
    }

    class Tab extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { title: 0, index: 1, disabled: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Tab",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*title*/ ctx[0] === undefined && !('title' in props)) {
    			console.warn("<Tab> was created without expected prop 'title'");
    		}

    		if (/*index*/ ctx[1] === undefined && !('index' in props)) {
    			console.warn("<Tab> was created without expected prop 'index'");
    		}
    	}

    	get title() {
    		throw new Error("<Tab>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<Tab>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get index() {
    		throw new Error("<Tab>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set index(value) {
    		throw new Error("<Tab>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get disabled() {
    		throw new Error("<Tab>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set disabled(value) {
    		throw new Error("<Tab>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules/@specialdoom/proi-ui/tabs/Tabs.svelte generated by Svelte v3.50.1 */

    const { console: console_1 } = globals;
    const file$2 = "node_modules/@specialdoom/proi-ui/tabs/Tabs.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[12] = list[i];
    	child_ctx[14] = i;
    	return child_ctx;
    }

    // (39:4) {#each $panes as pane, index}
    function create_each_block$1(ctx) {
    	let tab;
    	let current;

    	tab = new Tab({
    			props: {
    				index: /*index*/ ctx[14],
    				title: /*pane*/ ctx[12].title,
    				disabled: /*pane*/ ctx[12].disabled
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(tab.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(tab, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const tab_changes = {};
    			if (dirty & /*$panes*/ 4) tab_changes.title = /*pane*/ ctx[12].title;
    			if (dirty & /*$panes*/ 4) tab_changes.disabled = /*pane*/ ctx[12].disabled;
    			tab.$set(tab_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tab.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tab.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(tab, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(39:4) {#each $panes as pane, index}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div1;
    	let scrollbutton0;
    	let updating_visible;
    	let t0;
    	let div0;
    	let t1;
    	let scrollbutton1;
    	let updating_visible_1;
    	let t2;
    	let current;

    	function scrollbutton0_visible_binding(value) {
    		/*scrollbutton0_visible_binding*/ ctx[6](value);
    	}

    	let scrollbutton0_props = { direction: "left" };

    	if (/*elementOverflows*/ ctx[1] !== void 0) {
    		scrollbutton0_props.visible = /*elementOverflows*/ ctx[1];
    	}

    	scrollbutton0 = new ScrollButton({
    			props: scrollbutton0_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(scrollbutton0, 'visible', scrollbutton0_visible_binding));
    	scrollbutton0.$on("click", /*click_handler*/ ctx[7]);
    	let each_value = /*$panes*/ ctx[2];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	function scrollbutton1_visible_binding(value) {
    		/*scrollbutton1_visible_binding*/ ctx[9](value);
    	}

    	let scrollbutton1_props = { direction: "right" };

    	if (/*elementOverflows*/ ctx[1] !== void 0) {
    		scrollbutton1_props.visible = /*elementOverflows*/ ctx[1];
    	}

    	scrollbutton1 = new ScrollButton({
    			props: scrollbutton1_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(scrollbutton1, 'visible', scrollbutton1_visible_binding));
    	scrollbutton1.$on("click", /*click_handler_1*/ ctx[10]);
    	const default_slot_template = /*#slots*/ ctx[5].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[4], null);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			create_component(scrollbutton0.$$.fragment);
    			t0 = space();
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t1 = space();
    			create_component(scrollbutton1.$$.fragment);
    			t2 = space();
    			if (default_slot) default_slot.c();
    			attr_dev(div0, "class", "proi-tabs svelte-1rtcaw3");
    			add_location(div0, file$2, 37, 2, 1089);
    			attr_dev(div1, "class", "proi-tabs-container svelte-1rtcaw3");
    			add_location(div1, file$2, 29, 0, 892);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			mount_component(scrollbutton0, div1, null);
    			append_dev(div1, t0);
    			append_dev(div1, div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			/*div0_binding*/ ctx[8](div0);
    			append_dev(div1, t1);
    			mount_component(scrollbutton1, div1, null);
    			insert_dev(target, t2, anchor);

    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const scrollbutton0_changes = {};

    			if (!updating_visible && dirty & /*elementOverflows*/ 2) {
    				updating_visible = true;
    				scrollbutton0_changes.visible = /*elementOverflows*/ ctx[1];
    				add_flush_callback(() => updating_visible = false);
    			}

    			scrollbutton0.$set(scrollbutton0_changes);

    			if (dirty & /*$panes*/ 4) {
    				each_value = /*$panes*/ ctx[2];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div0, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			const scrollbutton1_changes = {};

    			if (!updating_visible_1 && dirty & /*elementOverflows*/ 2) {
    				updating_visible_1 = true;
    				scrollbutton1_changes.visible = /*elementOverflows*/ ctx[1];
    				add_flush_callback(() => updating_visible_1 = false);
    			}

    			scrollbutton1.$set(scrollbutton1_changes);

    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 16)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[4],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[4])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[4], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(scrollbutton0.$$.fragment, local);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			transition_in(scrollbutton1.$$.fragment, local);
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(scrollbutton0.$$.fragment, local);
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			transition_out(scrollbutton1.$$.fragment, local);
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(scrollbutton0);
    			destroy_each(each_blocks, detaching);
    			/*div0_binding*/ ctx[8](null);
    			destroy_component(scrollbutton1);
    			if (detaching) detach_dev(t2);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let $panes;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Tabs', slots, ['default']);
    	let panes = writable([]);
    	validate_store(panes, 'panes');
    	component_subscribe($$self, panes, value => $$invalidate(2, $panes = value));
    	let current = writable(0);
    	let tabsContainerElement;
    	let elementOverflows = false;

    	setContext(contextName, {
    		registerPane(pane) {
    			panes.set([...$panes, pane]);
    			current.set($panes.filter(p => !p.disabled)[0]?.index ?? 0);
    		},
    		selectTab(index) {
    			current.set(index);
    		},
    		current
    	});

    	onMount(() => {
    		if (!tabsContainerElement) return;
    		console.log(tabsContainerElement.scrollWidth, tabsContainerElement.clientWidth);

    		if (tabsContainerElement.scrollWidth > tabsContainerElement.clientWidth) {
    			$$invalidate(1, elementOverflows = true);
    		}
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Tabs> was created with unknown prop '${key}'`);
    	});

    	function scrollbutton0_visible_binding(value) {
    		elementOverflows = value;
    		$$invalidate(1, elementOverflows);
    	}

    	const click_handler = () => {
    		$$invalidate(0, tabsContainerElement.scrollLeft -= 300, tabsContainerElement);
    	};

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			tabsContainerElement = $$value;
    			$$invalidate(0, tabsContainerElement);
    		});
    	}

    	function scrollbutton1_visible_binding(value) {
    		elementOverflows = value;
    		$$invalidate(1, elementOverflows);
    	}

    	const click_handler_1 = () => {
    		$$invalidate(0, tabsContainerElement.scrollLeft += 300, tabsContainerElement);
    	};

    	$$self.$$set = $$props => {
    		if ('$$scope' in $$props) $$invalidate(4, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		setContext,
    		onMount,
    		writable,
    		ScrollButton,
    		Tab,
    		contextName,
    		panes,
    		current,
    		tabsContainerElement,
    		elementOverflows,
    		$panes
    	});

    	$$self.$inject_state = $$props => {
    		if ('panes' in $$props) $$invalidate(3, panes = $$props.panes);
    		if ('current' in $$props) current = $$props.current;
    		if ('tabsContainerElement' in $$props) $$invalidate(0, tabsContainerElement = $$props.tabsContainerElement);
    		if ('elementOverflows' in $$props) $$invalidate(1, elementOverflows = $$props.elementOverflows);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		tabsContainerElement,
    		elementOverflows,
    		$panes,
    		panes,
    		$$scope,
    		slots,
    		scrollbutton0_visible_binding,
    		click_handler,
    		div0_binding,
    		scrollbutton1_visible_binding,
    		click_handler_1
    	];
    }

    class Tabs extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Tabs",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    Object.assign(Tabs, {
        Pane: TabPane
    });

    /* node_modules/@specialdoom/proi-ui/input/TextInput.svelte generated by Svelte v3.50.1 */

    const file$1 = "node_modules/@specialdoom/proi-ui/input/TextInput.svelte";

    function create_fragment$1(ctx) {
    	let input;
    	let input_class_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "placeholder", /*placeholder*/ ctx[1]);
    			attr_dev(input, "class", input_class_value = "proi-input " + /*className*/ ctx[4] + " svelte-10enl2l");
    			input.disabled = /*disabled*/ ctx[3];
    			attr_dev(input, "type", "text");
    			toggle_class(input, "error", /*error*/ ctx[2]);
    			add_location(input, file$1, 7, 0, 160);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*value*/ ctx[0]);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[6]),
    					listen_dev(input, "change", /*change_handler*/ ctx[5], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*placeholder*/ 2) {
    				attr_dev(input, "placeholder", /*placeholder*/ ctx[1]);
    			}

    			if (dirty & /*className*/ 16 && input_class_value !== (input_class_value = "proi-input " + /*className*/ ctx[4] + " svelte-10enl2l")) {
    				attr_dev(input, "class", input_class_value);
    			}

    			if (dirty & /*disabled*/ 8) {
    				prop_dev(input, "disabled", /*disabled*/ ctx[3]);
    			}

    			if (dirty & /*value*/ 1 && input.value !== /*value*/ ctx[0]) {
    				set_input_value(input, /*value*/ ctx[0]);
    			}

    			if (dirty & /*className, error*/ 20) {
    				toggle_class(input, "error", /*error*/ ctx[2]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('TextInput', slots, []);
    	let { placeholder = "" } = $$props;
    	let { value = "" } = $$props;
    	let { error = false } = $$props;
    	let { disabled = false } = $$props;
    	let { className = "" } = $$props;
    	const writable_props = ['placeholder', 'value', 'error', 'disabled', 'className'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<TextInput> was created with unknown prop '${key}'`);
    	});

    	function change_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	function input_input_handler() {
    		value = this.value;
    		$$invalidate(0, value);
    	}

    	$$self.$$set = $$props => {
    		if ('placeholder' in $$props) $$invalidate(1, placeholder = $$props.placeholder);
    		if ('value' in $$props) $$invalidate(0, value = $$props.value);
    		if ('error' in $$props) $$invalidate(2, error = $$props.error);
    		if ('disabled' in $$props) $$invalidate(3, disabled = $$props.disabled);
    		if ('className' in $$props) $$invalidate(4, className = $$props.className);
    	};

    	$$self.$capture_state = () => ({
    		placeholder,
    		value,
    		error,
    		disabled,
    		className
    	});

    	$$self.$inject_state = $$props => {
    		if ('placeholder' in $$props) $$invalidate(1, placeholder = $$props.placeholder);
    		if ('value' in $$props) $$invalidate(0, value = $$props.value);
    		if ('error' in $$props) $$invalidate(2, error = $$props.error);
    		if ('disabled' in $$props) $$invalidate(3, disabled = $$props.disabled);
    		if ('className' in $$props) $$invalidate(4, className = $$props.className);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		value,
    		placeholder,
    		error,
    		disabled,
    		className,
    		change_handler,
    		input_input_handler
    	];
    }

    class TextInput extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			placeholder: 1,
    			value: 0,
    			error: 2,
    			disabled: 3,
    			className: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TextInput",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get placeholder() {
    		throw new Error("<TextInput>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set placeholder(value) {
    		throw new Error("<TextInput>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get value() {
    		throw new Error("<TextInput>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<TextInput>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get error() {
    		throw new Error("<TextInput>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set error(value) {
    		throw new Error("<TextInput>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get disabled() {
    		throw new Error("<TextInput>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set disabled(value) {
    		throw new Error("<TextInput>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get className() {
    		throw new Error("<TextInput>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set className(value) {
    		throw new Error("<TextInput>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    const stringToByteArray$1 = function (str) {
        // TODO(user): Use native implementations if/when available
        const out = [];
        let p = 0;
        for (let i = 0; i < str.length; i++) {
            let c = str.charCodeAt(i);
            if (c < 128) {
                out[p++] = c;
            }
            else if (c < 2048) {
                out[p++] = (c >> 6) | 192;
                out[p++] = (c & 63) | 128;
            }
            else if ((c & 0xfc00) === 0xd800 &&
                i + 1 < str.length &&
                (str.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
                // Surrogate Pair
                c = 0x10000 + ((c & 0x03ff) << 10) + (str.charCodeAt(++i) & 0x03ff);
                out[p++] = (c >> 18) | 240;
                out[p++] = ((c >> 12) & 63) | 128;
                out[p++] = ((c >> 6) & 63) | 128;
                out[p++] = (c & 63) | 128;
            }
            else {
                out[p++] = (c >> 12) | 224;
                out[p++] = ((c >> 6) & 63) | 128;
                out[p++] = (c & 63) | 128;
            }
        }
        return out;
    };
    /**
     * Turns an array of numbers into the string given by the concatenation of the
     * characters to which the numbers correspond.
     * @param bytes Array of numbers representing characters.
     * @return Stringification of the array.
     */
    const byteArrayToString = function (bytes) {
        // TODO(user): Use native implementations if/when available
        const out = [];
        let pos = 0, c = 0;
        while (pos < bytes.length) {
            const c1 = bytes[pos++];
            if (c1 < 128) {
                out[c++] = String.fromCharCode(c1);
            }
            else if (c1 > 191 && c1 < 224) {
                const c2 = bytes[pos++];
                out[c++] = String.fromCharCode(((c1 & 31) << 6) | (c2 & 63));
            }
            else if (c1 > 239 && c1 < 365) {
                // Surrogate Pair
                const c2 = bytes[pos++];
                const c3 = bytes[pos++];
                const c4 = bytes[pos++];
                const u = (((c1 & 7) << 18) | ((c2 & 63) << 12) | ((c3 & 63) << 6) | (c4 & 63)) -
                    0x10000;
                out[c++] = String.fromCharCode(0xd800 + (u >> 10));
                out[c++] = String.fromCharCode(0xdc00 + (u & 1023));
            }
            else {
                const c2 = bytes[pos++];
                const c3 = bytes[pos++];
                out[c++] = String.fromCharCode(((c1 & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
            }
        }
        return out.join('');
    };
    // We define it as an object literal instead of a class because a class compiled down to es5 can't
    // be treeshaked. https://github.com/rollup/rollup/issues/1691
    // Static lookup maps, lazily populated by init_()
    const base64 = {
        /**
         * Maps bytes to characters.
         */
        byteToCharMap_: null,
        /**
         * Maps characters to bytes.
         */
        charToByteMap_: null,
        /**
         * Maps bytes to websafe characters.
         * @private
         */
        byteToCharMapWebSafe_: null,
        /**
         * Maps websafe characters to bytes.
         * @private
         */
        charToByteMapWebSafe_: null,
        /**
         * Our default alphabet, shared between
         * ENCODED_VALS and ENCODED_VALS_WEBSAFE
         */
        ENCODED_VALS_BASE: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' + 'abcdefghijklmnopqrstuvwxyz' + '0123456789',
        /**
         * Our default alphabet. Value 64 (=) is special; it means "nothing."
         */
        get ENCODED_VALS() {
            return this.ENCODED_VALS_BASE + '+/=';
        },
        /**
         * Our websafe alphabet.
         */
        get ENCODED_VALS_WEBSAFE() {
            return this.ENCODED_VALS_BASE + '-_.';
        },
        /**
         * Whether this browser supports the atob and btoa functions. This extension
         * started at Mozilla but is now implemented by many browsers. We use the
         * ASSUME_* variables to avoid pulling in the full useragent detection library
         * but still allowing the standard per-browser compilations.
         *
         */
        HAS_NATIVE_SUPPORT: typeof atob === 'function',
        /**
         * Base64-encode an array of bytes.
         *
         * @param input An array of bytes (numbers with
         *     value in [0, 255]) to encode.
         * @param webSafe Boolean indicating we should use the
         *     alternative alphabet.
         * @return The base64 encoded string.
         */
        encodeByteArray(input, webSafe) {
            if (!Array.isArray(input)) {
                throw Error('encodeByteArray takes an array as a parameter');
            }
            this.init_();
            const byteToCharMap = webSafe
                ? this.byteToCharMapWebSafe_
                : this.byteToCharMap_;
            const output = [];
            for (let i = 0; i < input.length; i += 3) {
                const byte1 = input[i];
                const haveByte2 = i + 1 < input.length;
                const byte2 = haveByte2 ? input[i + 1] : 0;
                const haveByte3 = i + 2 < input.length;
                const byte3 = haveByte3 ? input[i + 2] : 0;
                const outByte1 = byte1 >> 2;
                const outByte2 = ((byte1 & 0x03) << 4) | (byte2 >> 4);
                let outByte3 = ((byte2 & 0x0f) << 2) | (byte3 >> 6);
                let outByte4 = byte3 & 0x3f;
                if (!haveByte3) {
                    outByte4 = 64;
                    if (!haveByte2) {
                        outByte3 = 64;
                    }
                }
                output.push(byteToCharMap[outByte1], byteToCharMap[outByte2], byteToCharMap[outByte3], byteToCharMap[outByte4]);
            }
            return output.join('');
        },
        /**
         * Base64-encode a string.
         *
         * @param input A string to encode.
         * @param webSafe If true, we should use the
         *     alternative alphabet.
         * @return The base64 encoded string.
         */
        encodeString(input, webSafe) {
            // Shortcut for Mozilla browsers that implement
            // a native base64 encoder in the form of "btoa/atob"
            if (this.HAS_NATIVE_SUPPORT && !webSafe) {
                return btoa(input);
            }
            return this.encodeByteArray(stringToByteArray$1(input), webSafe);
        },
        /**
         * Base64-decode a string.
         *
         * @param input to decode.
         * @param webSafe True if we should use the
         *     alternative alphabet.
         * @return string representing the decoded value.
         */
        decodeString(input, webSafe) {
            // Shortcut for Mozilla browsers that implement
            // a native base64 encoder in the form of "btoa/atob"
            if (this.HAS_NATIVE_SUPPORT && !webSafe) {
                return atob(input);
            }
            return byteArrayToString(this.decodeStringToByteArray(input, webSafe));
        },
        /**
         * Base64-decode a string.
         *
         * In base-64 decoding, groups of four characters are converted into three
         * bytes.  If the encoder did not apply padding, the input length may not
         * be a multiple of 4.
         *
         * In this case, the last group will have fewer than 4 characters, and
         * padding will be inferred.  If the group has one or two characters, it decodes
         * to one byte.  If the group has three characters, it decodes to two bytes.
         *
         * @param input Input to decode.
         * @param webSafe True if we should use the web-safe alphabet.
         * @return bytes representing the decoded value.
         */
        decodeStringToByteArray(input, webSafe) {
            this.init_();
            const charToByteMap = webSafe
                ? this.charToByteMapWebSafe_
                : this.charToByteMap_;
            const output = [];
            for (let i = 0; i < input.length;) {
                const byte1 = charToByteMap[input.charAt(i++)];
                const haveByte2 = i < input.length;
                const byte2 = haveByte2 ? charToByteMap[input.charAt(i)] : 0;
                ++i;
                const haveByte3 = i < input.length;
                const byte3 = haveByte3 ? charToByteMap[input.charAt(i)] : 64;
                ++i;
                const haveByte4 = i < input.length;
                const byte4 = haveByte4 ? charToByteMap[input.charAt(i)] : 64;
                ++i;
                if (byte1 == null || byte2 == null || byte3 == null || byte4 == null) {
                    throw Error();
                }
                const outByte1 = (byte1 << 2) | (byte2 >> 4);
                output.push(outByte1);
                if (byte3 !== 64) {
                    const outByte2 = ((byte2 << 4) & 0xf0) | (byte3 >> 2);
                    output.push(outByte2);
                    if (byte4 !== 64) {
                        const outByte3 = ((byte3 << 6) & 0xc0) | byte4;
                        output.push(outByte3);
                    }
                }
            }
            return output;
        },
        /**
         * Lazy static initialization function. Called before
         * accessing any of the static map variables.
         * @private
         */
        init_() {
            if (!this.byteToCharMap_) {
                this.byteToCharMap_ = {};
                this.charToByteMap_ = {};
                this.byteToCharMapWebSafe_ = {};
                this.charToByteMapWebSafe_ = {};
                // We want quick mappings back and forth, so we precompute two maps.
                for (let i = 0; i < this.ENCODED_VALS.length; i++) {
                    this.byteToCharMap_[i] = this.ENCODED_VALS.charAt(i);
                    this.charToByteMap_[this.byteToCharMap_[i]] = i;
                    this.byteToCharMapWebSafe_[i] = this.ENCODED_VALS_WEBSAFE.charAt(i);
                    this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[i]] = i;
                    // Be forgiving when decoding and correctly decode both encodings.
                    if (i >= this.ENCODED_VALS_BASE.length) {
                        this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(i)] = i;
                        this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(i)] = i;
                    }
                }
            }
        }
    };
    /**
     * URL-safe base64 encoding
     */
    const base64Encode = function (str) {
        const utf8Bytes = stringToByteArray$1(str);
        return base64.encodeByteArray(utf8Bytes, true);
    };
    /**
     * URL-safe base64 encoding (without "." padding in the end).
     * e.g. Used in JSON Web Token (JWT) parts.
     */
    const base64urlEncodeWithoutPadding = function (str) {
        // Use base64url encoding and remove padding in the end (dot characters).
        return base64Encode(str).replace(/\./g, '');
    };

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    class Deferred {
        constructor() {
            this.reject = () => { };
            this.resolve = () => { };
            this.promise = new Promise((resolve, reject) => {
                this.resolve = resolve;
                this.reject = reject;
            });
        }
        /**
         * Our API internals are not promiseified and cannot because our callback APIs have subtle expectations around
         * invoking promises inline, which Promises are forbidden to do. This method accepts an optional node-style callback
         * and returns a node-style callback which will resolve or reject the Deferred's promise.
         */
        wrapCallback(callback) {
            return (error, value) => {
                if (error) {
                    this.reject(error);
                }
                else {
                    this.resolve(value);
                }
                if (typeof callback === 'function') {
                    // Attaching noop handler just in case developer wasn't expecting
                    // promises
                    this.promise.catch(() => { });
                    // Some of our callbacks don't expect a value and our own tests
                    // assert that the parameter length is 1
                    if (callback.length === 1) {
                        callback(error);
                    }
                    else {
                        callback(error, value);
                    }
                }
            };
        }
    }
    /**
     * This method checks if indexedDB is supported by current browser/service worker context
     * @return true if indexedDB is supported by current browser/service worker context
     */
    function isIndexedDBAvailable() {
        return typeof indexedDB === 'object';
    }
    /**
     * This method validates browser/sw context for indexedDB by opening a dummy indexedDB database and reject
     * if errors occur during the database open operation.
     *
     * @throws exception if current browser/sw context can't run idb.open (ex: Safari iframe, Firefox
     * private browsing)
     */
    function validateIndexedDBOpenable() {
        return new Promise((resolve, reject) => {
            try {
                let preExist = true;
                const DB_CHECK_NAME = 'validate-browser-context-for-indexeddb-analytics-module';
                const request = self.indexedDB.open(DB_CHECK_NAME);
                request.onsuccess = () => {
                    request.result.close();
                    // delete database only when it doesn't pre-exist
                    if (!preExist) {
                        self.indexedDB.deleteDatabase(DB_CHECK_NAME);
                    }
                    resolve(true);
                };
                request.onupgradeneeded = () => {
                    preExist = false;
                };
                request.onerror = () => {
                    var _a;
                    reject(((_a = request.error) === null || _a === void 0 ? void 0 : _a.message) || '');
                };
            }
            catch (error) {
                reject(error);
            }
        });
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * @fileoverview Standardized Firebase Error.
     *
     * Usage:
     *
     *   // Typescript string literals for type-safe codes
     *   type Err =
     *     'unknown' |
     *     'object-not-found'
     *     ;
     *
     *   // Closure enum for type-safe error codes
     *   // at-enum {string}
     *   var Err = {
     *     UNKNOWN: 'unknown',
     *     OBJECT_NOT_FOUND: 'object-not-found',
     *   }
     *
     *   let errors: Map<Err, string> = {
     *     'generic-error': "Unknown error",
     *     'file-not-found': "Could not find file: {$file}",
     *   };
     *
     *   // Type-safe function - must pass a valid error code as param.
     *   let error = new ErrorFactory<Err>('service', 'Service', errors);
     *
     *   ...
     *   throw error.create(Err.GENERIC);
     *   ...
     *   throw error.create(Err.FILE_NOT_FOUND, {'file': fileName});
     *   ...
     *   // Service: Could not file file: foo.txt (service/file-not-found).
     *
     *   catch (e) {
     *     assert(e.message === "Could not find file: foo.txt.");
     *     if ((e as FirebaseError)?.code === 'service/file-not-found') {
     *       console.log("Could not read file: " + e['file']);
     *     }
     *   }
     */
    const ERROR_NAME = 'FirebaseError';
    // Based on code from:
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#Custom_Error_Types
    class FirebaseError extends Error {
        constructor(
        /** The error code for this error. */
        code, message, 
        /** Custom data for this error. */
        customData) {
            super(message);
            this.code = code;
            this.customData = customData;
            /** The custom name for all FirebaseErrors. */
            this.name = ERROR_NAME;
            // Fix For ES5
            // https://github.com/Microsoft/TypeScript-wiki/blob/master/Breaking-Changes.md#extending-built-ins-like-error-array-and-map-may-no-longer-work
            Object.setPrototypeOf(this, FirebaseError.prototype);
            // Maintains proper stack trace for where our error was thrown.
            // Only available on V8.
            if (Error.captureStackTrace) {
                Error.captureStackTrace(this, ErrorFactory.prototype.create);
            }
        }
    }
    class ErrorFactory {
        constructor(service, serviceName, errors) {
            this.service = service;
            this.serviceName = serviceName;
            this.errors = errors;
        }
        create(code, ...data) {
            const customData = data[0] || {};
            const fullCode = `${this.service}/${code}`;
            const template = this.errors[code];
            const message = template ? replaceTemplate(template, customData) : 'Error';
            // Service Name: Error message (service/code).
            const fullMessage = `${this.serviceName}: ${message} (${fullCode}).`;
            const error = new FirebaseError(fullCode, fullMessage, customData);
            return error;
        }
    }
    function replaceTemplate(template, data) {
        return template.replace(PATTERN, (_, key) => {
            const value = data[key];
            return value != null ? String(value) : `<${key}?>`;
        });
    }
    const PATTERN = /\{\$([^}]+)}/g;
    /**
     * Deep equal two objects. Support Arrays and Objects.
     */
    function deepEqual(a, b) {
        if (a === b) {
            return true;
        }
        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);
        for (const k of aKeys) {
            if (!bKeys.includes(k)) {
                return false;
            }
            const aProp = a[k];
            const bProp = b[k];
            if (isObject(aProp) && isObject(bProp)) {
                if (!deepEqual(aProp, bProp)) {
                    return false;
                }
            }
            else if (aProp !== bProp) {
                return false;
            }
        }
        for (const k of bKeys) {
            if (!aKeys.includes(k)) {
                return false;
            }
        }
        return true;
    }
    function isObject(thing) {
        return thing !== null && typeof thing === 'object';
    }

    /**
     * @license
     * Copyright 2021 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    function getModularInstance(service) {
        if (service && service._delegate) {
            return service._delegate;
        }
        else {
            return service;
        }
    }

    /**
     * Component for service name T, e.g. `auth`, `auth-internal`
     */
    class Component {
        /**
         *
         * @param name The public service name, e.g. app, auth, firestore, database
         * @param instanceFactory Service factory responsible for creating the public interface
         * @param type whether the service provided by the component is public or private
         */
        constructor(name, instanceFactory, type) {
            this.name = name;
            this.instanceFactory = instanceFactory;
            this.type = type;
            this.multipleInstances = false;
            /**
             * Properties to be added to the service namespace
             */
            this.serviceProps = {};
            this.instantiationMode = "LAZY" /* LAZY */;
            this.onInstanceCreated = null;
        }
        setInstantiationMode(mode) {
            this.instantiationMode = mode;
            return this;
        }
        setMultipleInstances(multipleInstances) {
            this.multipleInstances = multipleInstances;
            return this;
        }
        setServiceProps(props) {
            this.serviceProps = props;
            return this;
        }
        setInstanceCreatedCallback(callback) {
            this.onInstanceCreated = callback;
            return this;
        }
    }

    /**
     * @license
     * Copyright 2019 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    const DEFAULT_ENTRY_NAME$1 = '[DEFAULT]';

    /**
     * @license
     * Copyright 2019 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Provider for instance for service name T, e.g. 'auth', 'auth-internal'
     * NameServiceMapping[T] is an alias for the type of the instance
     */
    class Provider {
        constructor(name, container) {
            this.name = name;
            this.container = container;
            this.component = null;
            this.instances = new Map();
            this.instancesDeferred = new Map();
            this.instancesOptions = new Map();
            this.onInitCallbacks = new Map();
        }
        /**
         * @param identifier A provider can provide mulitple instances of a service
         * if this.component.multipleInstances is true.
         */
        get(identifier) {
            // if multipleInstances is not supported, use the default name
            const normalizedIdentifier = this.normalizeInstanceIdentifier(identifier);
            if (!this.instancesDeferred.has(normalizedIdentifier)) {
                const deferred = new Deferred();
                this.instancesDeferred.set(normalizedIdentifier, deferred);
                if (this.isInitialized(normalizedIdentifier) ||
                    this.shouldAutoInitialize()) {
                    // initialize the service if it can be auto-initialized
                    try {
                        const instance = this.getOrInitializeService({
                            instanceIdentifier: normalizedIdentifier
                        });
                        if (instance) {
                            deferred.resolve(instance);
                        }
                    }
                    catch (e) {
                        // when the instance factory throws an exception during get(), it should not cause
                        // a fatal error. We just return the unresolved promise in this case.
                    }
                }
            }
            return this.instancesDeferred.get(normalizedIdentifier).promise;
        }
        getImmediate(options) {
            var _a;
            // if multipleInstances is not supported, use the default name
            const normalizedIdentifier = this.normalizeInstanceIdentifier(options === null || options === void 0 ? void 0 : options.identifier);
            const optional = (_a = options === null || options === void 0 ? void 0 : options.optional) !== null && _a !== void 0 ? _a : false;
            if (this.isInitialized(normalizedIdentifier) ||
                this.shouldAutoInitialize()) {
                try {
                    return this.getOrInitializeService({
                        instanceIdentifier: normalizedIdentifier
                    });
                }
                catch (e) {
                    if (optional) {
                        return null;
                    }
                    else {
                        throw e;
                    }
                }
            }
            else {
                // In case a component is not initialized and should/can not be auto-initialized at the moment, return null if the optional flag is set, or throw
                if (optional) {
                    return null;
                }
                else {
                    throw Error(`Service ${this.name} is not available`);
                }
            }
        }
        getComponent() {
            return this.component;
        }
        setComponent(component) {
            if (component.name !== this.name) {
                throw Error(`Mismatching Component ${component.name} for Provider ${this.name}.`);
            }
            if (this.component) {
                throw Error(`Component for ${this.name} has already been provided`);
            }
            this.component = component;
            // return early without attempting to initialize the component if the component requires explicit initialization (calling `Provider.initialize()`)
            if (!this.shouldAutoInitialize()) {
                return;
            }
            // if the service is eager, initialize the default instance
            if (isComponentEager(component)) {
                try {
                    this.getOrInitializeService({ instanceIdentifier: DEFAULT_ENTRY_NAME$1 });
                }
                catch (e) {
                    // when the instance factory for an eager Component throws an exception during the eager
                    // initialization, it should not cause a fatal error.
                    // TODO: Investigate if we need to make it configurable, because some component may want to cause
                    // a fatal error in this case?
                }
            }
            // Create service instances for the pending promises and resolve them
            // NOTE: if this.multipleInstances is false, only the default instance will be created
            // and all promises with resolve with it regardless of the identifier.
            for (const [instanceIdentifier, instanceDeferred] of this.instancesDeferred.entries()) {
                const normalizedIdentifier = this.normalizeInstanceIdentifier(instanceIdentifier);
                try {
                    // `getOrInitializeService()` should always return a valid instance since a component is guaranteed. use ! to make typescript happy.
                    const instance = this.getOrInitializeService({
                        instanceIdentifier: normalizedIdentifier
                    });
                    instanceDeferred.resolve(instance);
                }
                catch (e) {
                    // when the instance factory throws an exception, it should not cause
                    // a fatal error. We just leave the promise unresolved.
                }
            }
        }
        clearInstance(identifier = DEFAULT_ENTRY_NAME$1) {
            this.instancesDeferred.delete(identifier);
            this.instancesOptions.delete(identifier);
            this.instances.delete(identifier);
        }
        // app.delete() will call this method on every provider to delete the services
        // TODO: should we mark the provider as deleted?
        async delete() {
            const services = Array.from(this.instances.values());
            await Promise.all([
                ...services
                    .filter(service => 'INTERNAL' in service) // legacy services
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .map(service => service.INTERNAL.delete()),
                ...services
                    .filter(service => '_delete' in service) // modularized services
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .map(service => service._delete())
            ]);
        }
        isComponentSet() {
            return this.component != null;
        }
        isInitialized(identifier = DEFAULT_ENTRY_NAME$1) {
            return this.instances.has(identifier);
        }
        getOptions(identifier = DEFAULT_ENTRY_NAME$1) {
            return this.instancesOptions.get(identifier) || {};
        }
        initialize(opts = {}) {
            const { options = {} } = opts;
            const normalizedIdentifier = this.normalizeInstanceIdentifier(opts.instanceIdentifier);
            if (this.isInitialized(normalizedIdentifier)) {
                throw Error(`${this.name}(${normalizedIdentifier}) has already been initialized`);
            }
            if (!this.isComponentSet()) {
                throw Error(`Component ${this.name} has not been registered yet`);
            }
            const instance = this.getOrInitializeService({
                instanceIdentifier: normalizedIdentifier,
                options
            });
            // resolve any pending promise waiting for the service instance
            for (const [instanceIdentifier, instanceDeferred] of this.instancesDeferred.entries()) {
                const normalizedDeferredIdentifier = this.normalizeInstanceIdentifier(instanceIdentifier);
                if (normalizedIdentifier === normalizedDeferredIdentifier) {
                    instanceDeferred.resolve(instance);
                }
            }
            return instance;
        }
        /**
         *
         * @param callback - a function that will be invoked  after the provider has been initialized by calling provider.initialize().
         * The function is invoked SYNCHRONOUSLY, so it should not execute any longrunning tasks in order to not block the program.
         *
         * @param identifier An optional instance identifier
         * @returns a function to unregister the callback
         */
        onInit(callback, identifier) {
            var _a;
            const normalizedIdentifier = this.normalizeInstanceIdentifier(identifier);
            const existingCallbacks = (_a = this.onInitCallbacks.get(normalizedIdentifier)) !== null && _a !== void 0 ? _a : new Set();
            existingCallbacks.add(callback);
            this.onInitCallbacks.set(normalizedIdentifier, existingCallbacks);
            const existingInstance = this.instances.get(normalizedIdentifier);
            if (existingInstance) {
                callback(existingInstance, normalizedIdentifier);
            }
            return () => {
                existingCallbacks.delete(callback);
            };
        }
        /**
         * Invoke onInit callbacks synchronously
         * @param instance the service instance`
         */
        invokeOnInitCallbacks(instance, identifier) {
            const callbacks = this.onInitCallbacks.get(identifier);
            if (!callbacks) {
                return;
            }
            for (const callback of callbacks) {
                try {
                    callback(instance, identifier);
                }
                catch (_a) {
                    // ignore errors in the onInit callback
                }
            }
        }
        getOrInitializeService({ instanceIdentifier, options = {} }) {
            let instance = this.instances.get(instanceIdentifier);
            if (!instance && this.component) {
                instance = this.component.instanceFactory(this.container, {
                    instanceIdentifier: normalizeIdentifierForFactory(instanceIdentifier),
                    options
                });
                this.instances.set(instanceIdentifier, instance);
                this.instancesOptions.set(instanceIdentifier, options);
                /**
                 * Invoke onInit listeners.
                 * Note this.component.onInstanceCreated is different, which is used by the component creator,
                 * while onInit listeners are registered by consumers of the provider.
                 */
                this.invokeOnInitCallbacks(instance, instanceIdentifier);
                /**
                 * Order is important
                 * onInstanceCreated() should be called after this.instances.set(instanceIdentifier, instance); which
                 * makes `isInitialized()` return true.
                 */
                if (this.component.onInstanceCreated) {
                    try {
                        this.component.onInstanceCreated(this.container, instanceIdentifier, instance);
                    }
                    catch (_a) {
                        // ignore errors in the onInstanceCreatedCallback
                    }
                }
            }
            return instance || null;
        }
        normalizeInstanceIdentifier(identifier = DEFAULT_ENTRY_NAME$1) {
            if (this.component) {
                return this.component.multipleInstances ? identifier : DEFAULT_ENTRY_NAME$1;
            }
            else {
                return identifier; // assume multiple instances are supported before the component is provided.
            }
        }
        shouldAutoInitialize() {
            return (!!this.component &&
                this.component.instantiationMode !== "EXPLICIT" /* EXPLICIT */);
        }
    }
    // undefined should be passed to the service factory for the default instance
    function normalizeIdentifierForFactory(identifier) {
        return identifier === DEFAULT_ENTRY_NAME$1 ? undefined : identifier;
    }
    function isComponentEager(component) {
        return component.instantiationMode === "EAGER" /* EAGER */;
    }

    /**
     * @license
     * Copyright 2019 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * ComponentContainer that provides Providers for service name T, e.g. `auth`, `auth-internal`
     */
    class ComponentContainer {
        constructor(name) {
            this.name = name;
            this.providers = new Map();
        }
        /**
         *
         * @param component Component being added
         * @param overwrite When a component with the same name has already been registered,
         * if overwrite is true: overwrite the existing component with the new component and create a new
         * provider with the new component. It can be useful in tests where you want to use different mocks
         * for different tests.
         * if overwrite is false: throw an exception
         */
        addComponent(component) {
            const provider = this.getProvider(component.name);
            if (provider.isComponentSet()) {
                throw new Error(`Component ${component.name} has already been registered with ${this.name}`);
            }
            provider.setComponent(component);
        }
        addOrOverwriteComponent(component) {
            const provider = this.getProvider(component.name);
            if (provider.isComponentSet()) {
                // delete the existing provider from the container, so we can register the new component
                this.providers.delete(component.name);
            }
            this.addComponent(component);
        }
        /**
         * getProvider provides a type safe interface where it can only be called with a field name
         * present in NameServiceMapping interface.
         *
         * Firebase SDKs providing services should extend NameServiceMapping interface to register
         * themselves.
         */
        getProvider(name) {
            if (this.providers.has(name)) {
                return this.providers.get(name);
            }
            // create a Provider for a service that hasn't registered with Firebase
            const provider = new Provider(name, this);
            this.providers.set(name, provider);
            return provider;
        }
        getProviders() {
            return Array.from(this.providers.values());
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * The JS SDK supports 5 log levels and also allows a user the ability to
     * silence the logs altogether.
     *
     * The order is a follows:
     * DEBUG < VERBOSE < INFO < WARN < ERROR
     *
     * All of the log types above the current log level will be captured (i.e. if
     * you set the log level to `INFO`, errors will still be logged, but `DEBUG` and
     * `VERBOSE` logs will not)
     */
    var LogLevel;
    (function (LogLevel) {
        LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
        LogLevel[LogLevel["VERBOSE"] = 1] = "VERBOSE";
        LogLevel[LogLevel["INFO"] = 2] = "INFO";
        LogLevel[LogLevel["WARN"] = 3] = "WARN";
        LogLevel[LogLevel["ERROR"] = 4] = "ERROR";
        LogLevel[LogLevel["SILENT"] = 5] = "SILENT";
    })(LogLevel || (LogLevel = {}));
    const levelStringToEnum = {
        'debug': LogLevel.DEBUG,
        'verbose': LogLevel.VERBOSE,
        'info': LogLevel.INFO,
        'warn': LogLevel.WARN,
        'error': LogLevel.ERROR,
        'silent': LogLevel.SILENT
    };
    /**
     * The default log level
     */
    const defaultLogLevel = LogLevel.INFO;
    /**
     * By default, `console.debug` is not displayed in the developer console (in
     * chrome). To avoid forcing users to have to opt-in to these logs twice
     * (i.e. once for firebase, and once in the console), we are sending `DEBUG`
     * logs to the `console.log` function.
     */
    const ConsoleMethod = {
        [LogLevel.DEBUG]: 'log',
        [LogLevel.VERBOSE]: 'log',
        [LogLevel.INFO]: 'info',
        [LogLevel.WARN]: 'warn',
        [LogLevel.ERROR]: 'error'
    };
    /**
     * The default log handler will forward DEBUG, VERBOSE, INFO, WARN, and ERROR
     * messages on to their corresponding console counterparts (if the log method
     * is supported by the current log level)
     */
    const defaultLogHandler = (instance, logType, ...args) => {
        if (logType < instance.logLevel) {
            return;
        }
        const now = new Date().toISOString();
        const method = ConsoleMethod[logType];
        if (method) {
            console[method](`[${now}]  ${instance.name}:`, ...args);
        }
        else {
            throw new Error(`Attempted to log a message with an invalid logType (value: ${logType})`);
        }
    };
    class Logger {
        /**
         * Gives you an instance of a Logger to capture messages according to
         * Firebase's logging scheme.
         *
         * @param name The name that the logs will be associated with
         */
        constructor(name) {
            this.name = name;
            /**
             * The log level of the given Logger instance.
             */
            this._logLevel = defaultLogLevel;
            /**
             * The main (internal) log handler for the Logger instance.
             * Can be set to a new function in internal package code but not by user.
             */
            this._logHandler = defaultLogHandler;
            /**
             * The optional, additional, user-defined log handler for the Logger instance.
             */
            this._userLogHandler = null;
        }
        get logLevel() {
            return this._logLevel;
        }
        set logLevel(val) {
            if (!(val in LogLevel)) {
                throw new TypeError(`Invalid value "${val}" assigned to \`logLevel\``);
            }
            this._logLevel = val;
        }
        // Workaround for setter/getter having to be the same type.
        setLogLevel(val) {
            this._logLevel = typeof val === 'string' ? levelStringToEnum[val] : val;
        }
        get logHandler() {
            return this._logHandler;
        }
        set logHandler(val) {
            if (typeof val !== 'function') {
                throw new TypeError('Value assigned to `logHandler` must be a function');
            }
            this._logHandler = val;
        }
        get userLogHandler() {
            return this._userLogHandler;
        }
        set userLogHandler(val) {
            this._userLogHandler = val;
        }
        /**
         * The functions below are all based on the `console` interface
         */
        debug(...args) {
            this._userLogHandler && this._userLogHandler(this, LogLevel.DEBUG, ...args);
            this._logHandler(this, LogLevel.DEBUG, ...args);
        }
        log(...args) {
            this._userLogHandler &&
                this._userLogHandler(this, LogLevel.VERBOSE, ...args);
            this._logHandler(this, LogLevel.VERBOSE, ...args);
        }
        info(...args) {
            this._userLogHandler && this._userLogHandler(this, LogLevel.INFO, ...args);
            this._logHandler(this, LogLevel.INFO, ...args);
        }
        warn(...args) {
            this._userLogHandler && this._userLogHandler(this, LogLevel.WARN, ...args);
            this._logHandler(this, LogLevel.WARN, ...args);
        }
        error(...args) {
            this._userLogHandler && this._userLogHandler(this, LogLevel.ERROR, ...args);
            this._logHandler(this, LogLevel.ERROR, ...args);
        }
    }

    const instanceOfAny = (object, constructors) => constructors.some((c) => object instanceof c);

    let idbProxyableTypes;
    let cursorAdvanceMethods;
    // This is a function to prevent it throwing up in node environments.
    function getIdbProxyableTypes() {
        return (idbProxyableTypes ||
            (idbProxyableTypes = [
                IDBDatabase,
                IDBObjectStore,
                IDBIndex,
                IDBCursor,
                IDBTransaction,
            ]));
    }
    // This is a function to prevent it throwing up in node environments.
    function getCursorAdvanceMethods() {
        return (cursorAdvanceMethods ||
            (cursorAdvanceMethods = [
                IDBCursor.prototype.advance,
                IDBCursor.prototype.continue,
                IDBCursor.prototype.continuePrimaryKey,
            ]));
    }
    const cursorRequestMap = new WeakMap();
    const transactionDoneMap = new WeakMap();
    const transactionStoreNamesMap = new WeakMap();
    const transformCache = new WeakMap();
    const reverseTransformCache = new WeakMap();
    function promisifyRequest(request) {
        const promise = new Promise((resolve, reject) => {
            const unlisten = () => {
                request.removeEventListener('success', success);
                request.removeEventListener('error', error);
            };
            const success = () => {
                resolve(wrap(request.result));
                unlisten();
            };
            const error = () => {
                reject(request.error);
                unlisten();
            };
            request.addEventListener('success', success);
            request.addEventListener('error', error);
        });
        promise
            .then((value) => {
            // Since cursoring reuses the IDBRequest (*sigh*), we cache it for later retrieval
            // (see wrapFunction).
            if (value instanceof IDBCursor) {
                cursorRequestMap.set(value, request);
            }
            // Catching to avoid "Uncaught Promise exceptions"
        })
            .catch(() => { });
        // This mapping exists in reverseTransformCache but doesn't doesn't exist in transformCache. This
        // is because we create many promises from a single IDBRequest.
        reverseTransformCache.set(promise, request);
        return promise;
    }
    function cacheDonePromiseForTransaction(tx) {
        // Early bail if we've already created a done promise for this transaction.
        if (transactionDoneMap.has(tx))
            return;
        const done = new Promise((resolve, reject) => {
            const unlisten = () => {
                tx.removeEventListener('complete', complete);
                tx.removeEventListener('error', error);
                tx.removeEventListener('abort', error);
            };
            const complete = () => {
                resolve();
                unlisten();
            };
            const error = () => {
                reject(tx.error || new DOMException('AbortError', 'AbortError'));
                unlisten();
            };
            tx.addEventListener('complete', complete);
            tx.addEventListener('error', error);
            tx.addEventListener('abort', error);
        });
        // Cache it for later retrieval.
        transactionDoneMap.set(tx, done);
    }
    let idbProxyTraps = {
        get(target, prop, receiver) {
            if (target instanceof IDBTransaction) {
                // Special handling for transaction.done.
                if (prop === 'done')
                    return transactionDoneMap.get(target);
                // Polyfill for objectStoreNames because of Edge.
                if (prop === 'objectStoreNames') {
                    return target.objectStoreNames || transactionStoreNamesMap.get(target);
                }
                // Make tx.store return the only store in the transaction, or undefined if there are many.
                if (prop === 'store') {
                    return receiver.objectStoreNames[1]
                        ? undefined
                        : receiver.objectStore(receiver.objectStoreNames[0]);
                }
            }
            // Else transform whatever we get back.
            return wrap(target[prop]);
        },
        set(target, prop, value) {
            target[prop] = value;
            return true;
        },
        has(target, prop) {
            if (target instanceof IDBTransaction &&
                (prop === 'done' || prop === 'store')) {
                return true;
            }
            return prop in target;
        },
    };
    function replaceTraps(callback) {
        idbProxyTraps = callback(idbProxyTraps);
    }
    function wrapFunction(func) {
        // Due to expected object equality (which is enforced by the caching in `wrap`), we
        // only create one new func per func.
        // Edge doesn't support objectStoreNames (booo), so we polyfill it here.
        if (func === IDBDatabase.prototype.transaction &&
            !('objectStoreNames' in IDBTransaction.prototype)) {
            return function (storeNames, ...args) {
                const tx = func.call(unwrap(this), storeNames, ...args);
                transactionStoreNamesMap.set(tx, storeNames.sort ? storeNames.sort() : [storeNames]);
                return wrap(tx);
            };
        }
        // Cursor methods are special, as the behaviour is a little more different to standard IDB. In
        // IDB, you advance the cursor and wait for a new 'success' on the IDBRequest that gave you the
        // cursor. It's kinda like a promise that can resolve with many values. That doesn't make sense
        // with real promises, so each advance methods returns a new promise for the cursor object, or
        // undefined if the end of the cursor has been reached.
        if (getCursorAdvanceMethods().includes(func)) {
            return function (...args) {
                // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
                // the original object.
                func.apply(unwrap(this), args);
                return wrap(cursorRequestMap.get(this));
            };
        }
        return function (...args) {
            // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
            // the original object.
            return wrap(func.apply(unwrap(this), args));
        };
    }
    function transformCachableValue(value) {
        if (typeof value === 'function')
            return wrapFunction(value);
        // This doesn't return, it just creates a 'done' promise for the transaction,
        // which is later returned for transaction.done (see idbObjectHandler).
        if (value instanceof IDBTransaction)
            cacheDonePromiseForTransaction(value);
        if (instanceOfAny(value, getIdbProxyableTypes()))
            return new Proxy(value, idbProxyTraps);
        // Return the same value back if we're not going to transform it.
        return value;
    }
    function wrap(value) {
        // We sometimes generate multiple promises from a single IDBRequest (eg when cursoring), because
        // IDB is weird and a single IDBRequest can yield many responses, so these can't be cached.
        if (value instanceof IDBRequest)
            return promisifyRequest(value);
        // If we've already transformed this value before, reuse the transformed value.
        // This is faster, but it also provides object equality.
        if (transformCache.has(value))
            return transformCache.get(value);
        const newValue = transformCachableValue(value);
        // Not all types are transformed.
        // These may be primitive types, so they can't be WeakMap keys.
        if (newValue !== value) {
            transformCache.set(value, newValue);
            reverseTransformCache.set(newValue, value);
        }
        return newValue;
    }
    const unwrap = (value) => reverseTransformCache.get(value);

    /**
     * Open a database.
     *
     * @param name Name of the database.
     * @param version Schema version.
     * @param callbacks Additional callbacks.
     */
    function openDB(name, version, { blocked, upgrade, blocking, terminated } = {}) {
        const request = indexedDB.open(name, version);
        const openPromise = wrap(request);
        if (upgrade) {
            request.addEventListener('upgradeneeded', (event) => {
                upgrade(wrap(request.result), event.oldVersion, event.newVersion, wrap(request.transaction));
            });
        }
        if (blocked)
            request.addEventListener('blocked', () => blocked());
        openPromise
            .then((db) => {
            if (terminated)
                db.addEventListener('close', () => terminated());
            if (blocking)
                db.addEventListener('versionchange', () => blocking());
        })
            .catch(() => { });
        return openPromise;
    }

    const readMethods = ['get', 'getKey', 'getAll', 'getAllKeys', 'count'];
    const writeMethods = ['put', 'add', 'delete', 'clear'];
    const cachedMethods = new Map();
    function getMethod(target, prop) {
        if (!(target instanceof IDBDatabase &&
            !(prop in target) &&
            typeof prop === 'string')) {
            return;
        }
        if (cachedMethods.get(prop))
            return cachedMethods.get(prop);
        const targetFuncName = prop.replace(/FromIndex$/, '');
        const useIndex = prop !== targetFuncName;
        const isWrite = writeMethods.includes(targetFuncName);
        if (
        // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
        !(targetFuncName in (useIndex ? IDBIndex : IDBObjectStore).prototype) ||
            !(isWrite || readMethods.includes(targetFuncName))) {
            return;
        }
        const method = async function (storeName, ...args) {
            // isWrite ? 'readwrite' : undefined gzipps better, but fails in Edge :(
            const tx = this.transaction(storeName, isWrite ? 'readwrite' : 'readonly');
            let target = tx.store;
            if (useIndex)
                target = target.index(args.shift());
            // Must reject if op rejects.
            // If it's a write operation, must reject if tx.done rejects.
            // Must reject with op rejection first.
            // Must resolve with op value.
            // Must handle both promises (no unhandled rejections)
            return (await Promise.all([
                target[targetFuncName](...args),
                isWrite && tx.done,
            ]))[0];
        };
        cachedMethods.set(prop, method);
        return method;
    }
    replaceTraps((oldTraps) => ({
        ...oldTraps,
        get: (target, prop, receiver) => getMethod(target, prop) || oldTraps.get(target, prop, receiver),
        has: (target, prop) => !!getMethod(target, prop) || oldTraps.has(target, prop),
    }));

    /**
     * @license
     * Copyright 2019 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    class PlatformLoggerServiceImpl {
        constructor(container) {
            this.container = container;
        }
        // In initial implementation, this will be called by installations on
        // auth token refresh, and installations will send this string.
        getPlatformInfoString() {
            const providers = this.container.getProviders();
            // Loop through providers and get library/version pairs from any that are
            // version components.
            return providers
                .map(provider => {
                if (isVersionServiceProvider(provider)) {
                    const service = provider.getImmediate();
                    return `${service.library}/${service.version}`;
                }
                else {
                    return null;
                }
            })
                .filter(logString => logString)
                .join(' ');
        }
    }
    /**
     *
     * @param provider check if this provider provides a VersionService
     *
     * NOTE: Using Provider<'app-version'> is a hack to indicate that the provider
     * provides VersionService. The provider is not necessarily a 'app-version'
     * provider.
     */
    function isVersionServiceProvider(provider) {
        const component = provider.getComponent();
        return (component === null || component === void 0 ? void 0 : component.type) === "VERSION" /* VERSION */;
    }

    const name$o = "@firebase/app";
    const version$1 = "0.7.33";

    /**
     * @license
     * Copyright 2019 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    const logger = new Logger('@firebase/app');

    const name$n = "@firebase/app-compat";

    const name$m = "@firebase/analytics-compat";

    const name$l = "@firebase/analytics";

    const name$k = "@firebase/app-check-compat";

    const name$j = "@firebase/app-check";

    const name$i = "@firebase/auth";

    const name$h = "@firebase/auth-compat";

    const name$g = "@firebase/database";

    const name$f = "@firebase/database-compat";

    const name$e = "@firebase/functions";

    const name$d = "@firebase/functions-compat";

    const name$c = "@firebase/installations";

    const name$b = "@firebase/installations-compat";

    const name$a = "@firebase/messaging";

    const name$9 = "@firebase/messaging-compat";

    const name$8 = "@firebase/performance";

    const name$7 = "@firebase/performance-compat";

    const name$6 = "@firebase/remote-config";

    const name$5 = "@firebase/remote-config-compat";

    const name$4 = "@firebase/storage";

    const name$3 = "@firebase/storage-compat";

    const name$2 = "@firebase/firestore";

    const name$1 = "@firebase/firestore-compat";

    const name$p = "firebase";
    const version$2 = "9.10.0";

    /**
     * @license
     * Copyright 2019 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * The default app name
     *
     * @internal
     */
    const DEFAULT_ENTRY_NAME = '[DEFAULT]';
    const PLATFORM_LOG_STRING = {
        [name$o]: 'fire-core',
        [name$n]: 'fire-core-compat',
        [name$l]: 'fire-analytics',
        [name$m]: 'fire-analytics-compat',
        [name$j]: 'fire-app-check',
        [name$k]: 'fire-app-check-compat',
        [name$i]: 'fire-auth',
        [name$h]: 'fire-auth-compat',
        [name$g]: 'fire-rtdb',
        [name$f]: 'fire-rtdb-compat',
        [name$e]: 'fire-fn',
        [name$d]: 'fire-fn-compat',
        [name$c]: 'fire-iid',
        [name$b]: 'fire-iid-compat',
        [name$a]: 'fire-fcm',
        [name$9]: 'fire-fcm-compat',
        [name$8]: 'fire-perf',
        [name$7]: 'fire-perf-compat',
        [name$6]: 'fire-rc',
        [name$5]: 'fire-rc-compat',
        [name$4]: 'fire-gcs',
        [name$3]: 'fire-gcs-compat',
        [name$2]: 'fire-fst',
        [name$1]: 'fire-fst-compat',
        'fire-js': 'fire-js',
        [name$p]: 'fire-js-all'
    };

    /**
     * @license
     * Copyright 2019 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * @internal
     */
    const _apps = new Map();
    /**
     * Registered components.
     *
     * @internal
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _components = new Map();
    /**
     * @param component - the component being added to this app's container
     *
     * @internal
     */
    function _addComponent(app, component) {
        try {
            app.container.addComponent(component);
        }
        catch (e) {
            logger.debug(`Component ${component.name} failed to register with FirebaseApp ${app.name}`, e);
        }
    }
    /**
     *
     * @param component - the component to register
     * @returns whether or not the component is registered successfully
     *
     * @internal
     */
    function _registerComponent(component) {
        const componentName = component.name;
        if (_components.has(componentName)) {
            logger.debug(`There were multiple attempts to register component ${componentName}.`);
            return false;
        }
        _components.set(componentName, component);
        // add the component to existing app instances
        for (const app of _apps.values()) {
            _addComponent(app, component);
        }
        return true;
    }
    /**
     *
     * @param app - FirebaseApp instance
     * @param name - service name
     *
     * @returns the provider for the service with the matching name
     *
     * @internal
     */
    function _getProvider(app, name) {
        const heartbeatController = app.container
            .getProvider('heartbeat')
            .getImmediate({ optional: true });
        if (heartbeatController) {
            void heartbeatController.triggerHeartbeat();
        }
        return app.container.getProvider(name);
    }

    /**
     * @license
     * Copyright 2019 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    const ERRORS = {
        ["no-app" /* NO_APP */]: "No Firebase App '{$appName}' has been created - " +
            'call Firebase App.initializeApp()',
        ["bad-app-name" /* BAD_APP_NAME */]: "Illegal App name: '{$appName}",
        ["duplicate-app" /* DUPLICATE_APP */]: "Firebase App named '{$appName}' already exists with different options or config",
        ["app-deleted" /* APP_DELETED */]: "Firebase App named '{$appName}' already deleted",
        ["invalid-app-argument" /* INVALID_APP_ARGUMENT */]: 'firebase.{$appName}() takes either no argument or a ' +
            'Firebase App instance.',
        ["invalid-log-argument" /* INVALID_LOG_ARGUMENT */]: 'First argument to `onLog` must be null or a function.',
        ["idb-open" /* IDB_OPEN */]: 'Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.',
        ["idb-get" /* IDB_GET */]: 'Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.',
        ["idb-set" /* IDB_WRITE */]: 'Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.',
        ["idb-delete" /* IDB_DELETE */]: 'Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.'
    };
    const ERROR_FACTORY = new ErrorFactory('app', 'Firebase', ERRORS);

    /**
     * @license
     * Copyright 2019 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    class FirebaseAppImpl {
        constructor(options, config, container) {
            this._isDeleted = false;
            this._options = Object.assign({}, options);
            this._config = Object.assign({}, config);
            this._name = config.name;
            this._automaticDataCollectionEnabled =
                config.automaticDataCollectionEnabled;
            this._container = container;
            this.container.addComponent(new Component('app', () => this, "PUBLIC" /* PUBLIC */));
        }
        get automaticDataCollectionEnabled() {
            this.checkDestroyed();
            return this._automaticDataCollectionEnabled;
        }
        set automaticDataCollectionEnabled(val) {
            this.checkDestroyed();
            this._automaticDataCollectionEnabled = val;
        }
        get name() {
            this.checkDestroyed();
            return this._name;
        }
        get options() {
            this.checkDestroyed();
            return this._options;
        }
        get config() {
            this.checkDestroyed();
            return this._config;
        }
        get container() {
            return this._container;
        }
        get isDeleted() {
            return this._isDeleted;
        }
        set isDeleted(val) {
            this._isDeleted = val;
        }
        /**
         * This function will throw an Error if the App has already been deleted -
         * use before performing API actions on the App.
         */
        checkDestroyed() {
            if (this.isDeleted) {
                throw ERROR_FACTORY.create("app-deleted" /* APP_DELETED */, { appName: this._name });
            }
        }
    }

    /**
     * @license
     * Copyright 2019 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * The current SDK version.
     *
     * @public
     */
    const SDK_VERSION = version$2;
    function initializeApp(options, rawConfig = {}) {
        if (typeof rawConfig !== 'object') {
            const name = rawConfig;
            rawConfig = { name };
        }
        const config = Object.assign({ name: DEFAULT_ENTRY_NAME, automaticDataCollectionEnabled: false }, rawConfig);
        const name = config.name;
        if (typeof name !== 'string' || !name) {
            throw ERROR_FACTORY.create("bad-app-name" /* BAD_APP_NAME */, {
                appName: String(name)
            });
        }
        const existingApp = _apps.get(name);
        if (existingApp) {
            // return the existing app if options and config deep equal the ones in the existing app.
            if (deepEqual(options, existingApp.options) &&
                deepEqual(config, existingApp.config)) {
                return existingApp;
            }
            else {
                throw ERROR_FACTORY.create("duplicate-app" /* DUPLICATE_APP */, { appName: name });
            }
        }
        const container = new ComponentContainer(name);
        for (const component of _components.values()) {
            container.addComponent(component);
        }
        const newApp = new FirebaseAppImpl(options, config, container);
        _apps.set(name, newApp);
        return newApp;
    }
    /**
     * Retrieves a {@link @firebase/app#FirebaseApp} instance.
     *
     * When called with no arguments, the default app is returned. When an app name
     * is provided, the app corresponding to that name is returned.
     *
     * An exception is thrown if the app being retrieved has not yet been
     * initialized.
     *
     * @example
     * ```javascript
     * // Return the default app
     * const app = getApp();
     * ```
     *
     * @example
     * ```javascript
     * // Return a named app
     * const otherApp = getApp("otherApp");
     * ```
     *
     * @param name - Optional name of the app to return. If no name is
     *   provided, the default is `"[DEFAULT]"`.
     *
     * @returns The app corresponding to the provided app name.
     *   If no app name is provided, the default app is returned.
     *
     * @public
     */
    function getApp(name = DEFAULT_ENTRY_NAME) {
        const app = _apps.get(name);
        if (!app) {
            throw ERROR_FACTORY.create("no-app" /* NO_APP */, { appName: name });
        }
        return app;
    }
    /**
     * Registers a library's name and version for platform logging purposes.
     * @param library - Name of 1p or 3p library (e.g. firestore, angularfire)
     * @param version - Current version of that library.
     * @param variant - Bundle variant, e.g., node, rn, etc.
     *
     * @public
     */
    function registerVersion(libraryKeyOrName, version, variant) {
        var _a;
        // TODO: We can use this check to whitelist strings when/if we set up
        // a good whitelist system.
        let library = (_a = PLATFORM_LOG_STRING[libraryKeyOrName]) !== null && _a !== void 0 ? _a : libraryKeyOrName;
        if (variant) {
            library += `-${variant}`;
        }
        const libraryMismatch = library.match(/\s|\//);
        const versionMismatch = version.match(/\s|\//);
        if (libraryMismatch || versionMismatch) {
            const warning = [
                `Unable to register library "${library}" with version "${version}":`
            ];
            if (libraryMismatch) {
                warning.push(`library name "${library}" contains illegal characters (whitespace or "/")`);
            }
            if (libraryMismatch && versionMismatch) {
                warning.push('and');
            }
            if (versionMismatch) {
                warning.push(`version name "${version}" contains illegal characters (whitespace or "/")`);
            }
            logger.warn(warning.join(' '));
            return;
        }
        _registerComponent(new Component(`${library}-version`, () => ({ library, version }), "VERSION" /* VERSION */));
    }

    /**
     * @license
     * Copyright 2021 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    const DB_NAME = 'firebase-heartbeat-database';
    const DB_VERSION = 1;
    const STORE_NAME = 'firebase-heartbeat-store';
    let dbPromise = null;
    function getDbPromise() {
        if (!dbPromise) {
            dbPromise = openDB(DB_NAME, DB_VERSION, {
                upgrade: (db, oldVersion) => {
                    // We don't use 'break' in this switch statement, the fall-through
                    // behavior is what we want, because if there are multiple versions between
                    // the old version and the current version, we want ALL the migrations
                    // that correspond to those versions to run, not only the last one.
                    // eslint-disable-next-line default-case
                    switch (oldVersion) {
                        case 0:
                            db.createObjectStore(STORE_NAME);
                    }
                }
            }).catch(e => {
                throw ERROR_FACTORY.create("idb-open" /* IDB_OPEN */, {
                    originalErrorMessage: e.message
                });
            });
        }
        return dbPromise;
    }
    async function readHeartbeatsFromIndexedDB(app) {
        var _a;
        try {
            const db = await getDbPromise();
            return db
                .transaction(STORE_NAME)
                .objectStore(STORE_NAME)
                .get(computeKey(app));
        }
        catch (e) {
            if (e instanceof FirebaseError) {
                logger.warn(e.message);
            }
            else {
                const idbGetError = ERROR_FACTORY.create("idb-get" /* IDB_GET */, {
                    originalErrorMessage: (_a = e) === null || _a === void 0 ? void 0 : _a.message
                });
                logger.warn(idbGetError.message);
            }
        }
    }
    async function writeHeartbeatsToIndexedDB(app, heartbeatObject) {
        var _a;
        try {
            const db = await getDbPromise();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const objectStore = tx.objectStore(STORE_NAME);
            await objectStore.put(heartbeatObject, computeKey(app));
            return tx.done;
        }
        catch (e) {
            if (e instanceof FirebaseError) {
                logger.warn(e.message);
            }
            else {
                const idbGetError = ERROR_FACTORY.create("idb-set" /* IDB_WRITE */, {
                    originalErrorMessage: (_a = e) === null || _a === void 0 ? void 0 : _a.message
                });
                logger.warn(idbGetError.message);
            }
        }
    }
    function computeKey(app) {
        return `${app.name}!${app.options.appId}`;
    }

    /**
     * @license
     * Copyright 2021 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    const MAX_HEADER_BYTES = 1024;
    // 30 days
    const STORED_HEARTBEAT_RETENTION_MAX_MILLIS = 30 * 24 * 60 * 60 * 1000;
    class HeartbeatServiceImpl {
        constructor(container) {
            this.container = container;
            /**
             * In-memory cache for heartbeats, used by getHeartbeatsHeader() to generate
             * the header string.
             * Stores one record per date. This will be consolidated into the standard
             * format of one record per user agent string before being sent as a header.
             * Populated from indexedDB when the controller is instantiated and should
             * be kept in sync with indexedDB.
             * Leave public for easier testing.
             */
            this._heartbeatsCache = null;
            const app = this.container.getProvider('app').getImmediate();
            this._storage = new HeartbeatStorageImpl(app);
            this._heartbeatsCachePromise = this._storage.read().then(result => {
                this._heartbeatsCache = result;
                return result;
            });
        }
        /**
         * Called to report a heartbeat. The function will generate
         * a HeartbeatsByUserAgent object, update heartbeatsCache, and persist it
         * to IndexedDB.
         * Note that we only store one heartbeat per day. So if a heartbeat for today is
         * already logged, subsequent calls to this function in the same day will be ignored.
         */
        async triggerHeartbeat() {
            const platformLogger = this.container
                .getProvider('platform-logger')
                .getImmediate();
            // This is the "Firebase user agent" string from the platform logger
            // service, not the browser user agent.
            const agent = platformLogger.getPlatformInfoString();
            const date = getUTCDateString();
            if (this._heartbeatsCache === null) {
                this._heartbeatsCache = await this._heartbeatsCachePromise;
            }
            // Do not store a heartbeat if one is already stored for this day
            // or if a header has already been sent today.
            if (this._heartbeatsCache.lastSentHeartbeatDate === date ||
                this._heartbeatsCache.heartbeats.some(singleDateHeartbeat => singleDateHeartbeat.date === date)) {
                return;
            }
            else {
                // There is no entry for this date. Create one.
                this._heartbeatsCache.heartbeats.push({ date, agent });
            }
            // Remove entries older than 30 days.
            this._heartbeatsCache.heartbeats = this._heartbeatsCache.heartbeats.filter(singleDateHeartbeat => {
                const hbTimestamp = new Date(singleDateHeartbeat.date).valueOf();
                const now = Date.now();
                return now - hbTimestamp <= STORED_HEARTBEAT_RETENTION_MAX_MILLIS;
            });
            return this._storage.overwrite(this._heartbeatsCache);
        }
        /**
         * Returns a base64 encoded string which can be attached to the heartbeat-specific header directly.
         * It also clears all heartbeats from memory as well as in IndexedDB.
         *
         * NOTE: Consuming product SDKs should not send the header if this method
         * returns an empty string.
         */
        async getHeartbeatsHeader() {
            if (this._heartbeatsCache === null) {
                await this._heartbeatsCachePromise;
            }
            // If it's still null or the array is empty, there is no data to send.
            if (this._heartbeatsCache === null ||
                this._heartbeatsCache.heartbeats.length === 0) {
                return '';
            }
            const date = getUTCDateString();
            // Extract as many heartbeats from the cache as will fit under the size limit.
            const { heartbeatsToSend, unsentEntries } = extractHeartbeatsForHeader(this._heartbeatsCache.heartbeats);
            const headerString = base64urlEncodeWithoutPadding(JSON.stringify({ version: 2, heartbeats: heartbeatsToSend }));
            // Store last sent date to prevent another being logged/sent for the same day.
            this._heartbeatsCache.lastSentHeartbeatDate = date;
            if (unsentEntries.length > 0) {
                // Store any unsent entries if they exist.
                this._heartbeatsCache.heartbeats = unsentEntries;
                // This seems more likely than emptying the array (below) to lead to some odd state
                // since the cache isn't empty and this will be called again on the next request,
                // and is probably safest if we await it.
                await this._storage.overwrite(this._heartbeatsCache);
            }
            else {
                this._heartbeatsCache.heartbeats = [];
                // Do not wait for this, to reduce latency.
                void this._storage.overwrite(this._heartbeatsCache);
            }
            return headerString;
        }
    }
    function getUTCDateString() {
        const today = new Date();
        // Returns date format 'YYYY-MM-DD'
        return today.toISOString().substring(0, 10);
    }
    function extractHeartbeatsForHeader(heartbeatsCache, maxSize = MAX_HEADER_BYTES) {
        // Heartbeats grouped by user agent in the standard format to be sent in
        // the header.
        const heartbeatsToSend = [];
        // Single date format heartbeats that are not sent.
        let unsentEntries = heartbeatsCache.slice();
        for (const singleDateHeartbeat of heartbeatsCache) {
            // Look for an existing entry with the same user agent.
            const heartbeatEntry = heartbeatsToSend.find(hb => hb.agent === singleDateHeartbeat.agent);
            if (!heartbeatEntry) {
                // If no entry for this user agent exists, create one.
                heartbeatsToSend.push({
                    agent: singleDateHeartbeat.agent,
                    dates: [singleDateHeartbeat.date]
                });
                if (countBytes(heartbeatsToSend) > maxSize) {
                    // If the header would exceed max size, remove the added heartbeat
                    // entry and stop adding to the header.
                    heartbeatsToSend.pop();
                    break;
                }
            }
            else {
                heartbeatEntry.dates.push(singleDateHeartbeat.date);
                // If the header would exceed max size, remove the added date
                // and stop adding to the header.
                if (countBytes(heartbeatsToSend) > maxSize) {
                    heartbeatEntry.dates.pop();
                    break;
                }
            }
            // Pop unsent entry from queue. (Skipped if adding the entry exceeded
            // quota and the loop breaks early.)
            unsentEntries = unsentEntries.slice(1);
        }
        return {
            heartbeatsToSend,
            unsentEntries
        };
    }
    class HeartbeatStorageImpl {
        constructor(app) {
            this.app = app;
            this._canUseIndexedDBPromise = this.runIndexedDBEnvironmentCheck();
        }
        async runIndexedDBEnvironmentCheck() {
            if (!isIndexedDBAvailable()) {
                return false;
            }
            else {
                return validateIndexedDBOpenable()
                    .then(() => true)
                    .catch(() => false);
            }
        }
        /**
         * Read all heartbeats.
         */
        async read() {
            const canUseIndexedDB = await this._canUseIndexedDBPromise;
            if (!canUseIndexedDB) {
                return { heartbeats: [] };
            }
            else {
                const idbHeartbeatObject = await readHeartbeatsFromIndexedDB(this.app);
                return idbHeartbeatObject || { heartbeats: [] };
            }
        }
        // overwrite the storage with the provided heartbeats
        async overwrite(heartbeatsObject) {
            var _a;
            const canUseIndexedDB = await this._canUseIndexedDBPromise;
            if (!canUseIndexedDB) {
                return;
            }
            else {
                const existingHeartbeatsObject = await this.read();
                return writeHeartbeatsToIndexedDB(this.app, {
                    lastSentHeartbeatDate: (_a = heartbeatsObject.lastSentHeartbeatDate) !== null && _a !== void 0 ? _a : existingHeartbeatsObject.lastSentHeartbeatDate,
                    heartbeats: heartbeatsObject.heartbeats
                });
            }
        }
        // add heartbeats
        async add(heartbeatsObject) {
            var _a;
            const canUseIndexedDB = await this._canUseIndexedDBPromise;
            if (!canUseIndexedDB) {
                return;
            }
            else {
                const existingHeartbeatsObject = await this.read();
                return writeHeartbeatsToIndexedDB(this.app, {
                    lastSentHeartbeatDate: (_a = heartbeatsObject.lastSentHeartbeatDate) !== null && _a !== void 0 ? _a : existingHeartbeatsObject.lastSentHeartbeatDate,
                    heartbeats: [
                        ...existingHeartbeatsObject.heartbeats,
                        ...heartbeatsObject.heartbeats
                    ]
                });
            }
        }
    }
    /**
     * Calculate bytes of a HeartbeatsByUserAgent array after being wrapped
     * in a platform logging header JSON object, stringified, and converted
     * to base 64.
     */
    function countBytes(heartbeatsCache) {
        // base64 has a restricted set of characters, all of which should be 1 byte.
        return base64urlEncodeWithoutPadding(
        // heartbeatsCache wrapper properties
        JSON.stringify({ version: 2, heartbeats: heartbeatsCache })).length;
    }

    /**
     * @license
     * Copyright 2019 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    function registerCoreComponents(variant) {
        _registerComponent(new Component('platform-logger', container => new PlatformLoggerServiceImpl(container), "PRIVATE" /* PRIVATE */));
        _registerComponent(new Component('heartbeat', container => new HeartbeatServiceImpl(container), "PRIVATE" /* PRIVATE */));
        // Register `app` package.
        registerVersion(name$o, version$1, variant);
        // BUILD_TARGET will be replaced by values like esm5, esm2017, cjs5, etc during the compilation
        registerVersion(name$o, version$1, 'esm2017');
        // Register platform SDK identifier (no version).
        registerVersion('fire-js', '');
    }

    /**
     * Firebase App
     *
     * @remarks This package coordinates the communication between the different Firebase components
     * @packageDocumentation
     */
    registerCoreComponents('');

    var name = "firebase";
    var version = "9.10.0";

    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    registerVersion(name, version, 'app');

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    /*

     Copyright The Closure Library Authors.
     SPDX-License-Identifier: Apache-2.0
    */

    var k$1,goog=goog||{},l=commonjsGlobal||self;function aa(){}function ba(a){var b=typeof a;b="object"!=b?b:a?Array.isArray(a)?"array":b:"null";return "array"==b||"object"==b&&"number"==typeof a.length}function p(a){var b=typeof a;return "object"==b&&null!=a||"function"==b}function ca(a){return Object.prototype.hasOwnProperty.call(a,da$1)&&a[da$1]||(a[da$1]=++ea)}var da$1="closure_uid_"+(1E9*Math.random()>>>0),ea=0;function fa$1(a,b,c){return a.call.apply(a.bind,arguments)}
    function ha$1(a,b,c){if(!a)throw Error();if(2<arguments.length){var d=Array.prototype.slice.call(arguments,2);return function(){var e=Array.prototype.slice.call(arguments);Array.prototype.unshift.apply(e,d);return a.apply(b,e)}}return function(){return a.apply(b,arguments)}}function q$1(a,b,c){Function.prototype.bind&&-1!=Function.prototype.bind.toString().indexOf("native code")?q$1=fa$1:q$1=ha$1;return q$1.apply(null,arguments)}
    function ia(a,b){var c=Array.prototype.slice.call(arguments,1);return function(){var d=c.slice();d.push.apply(d,arguments);return a.apply(this,d)}}function t(a,b){function c(){}c.prototype=b.prototype;a.X=b.prototype;a.prototype=new c;a.prototype.constructor=a;a.Vb=function(d,e,f){for(var h=Array(arguments.length-2),n=2;n<arguments.length;n++)h[n-2]=arguments[n];return b.prototype[e].apply(d,h)};}function v$1(){this.s=this.s;this.o=this.o;}var ja=0;v$1.prototype.s=!1;v$1.prototype.na=function(){if(!this.s&&(this.s=!0,this.M(),0!=ja)){ca(this);}};v$1.prototype.M=function(){if(this.o)for(;this.o.length;)this.o.shift()();};const la$1=Array.prototype.indexOf?function(a,b){return Array.prototype.indexOf.call(a,b,void 0)}:function(a,b){if("string"===typeof a)return "string"!==typeof b||1!=b.length?-1:a.indexOf(b,0);for(let c=0;c<a.length;c++)if(c in a&&a[c]===b)return c;return -1};function ma$1(a){const b=a.length;if(0<b){const c=Array(b);for(let d=0;d<b;d++)c[d]=a[d];return c}return []}
    function na(a,b){for(let c=1;c<arguments.length;c++){const d=arguments[c];if(ba(d)){const e=a.length||0,f=d.length||0;a.length=e+f;for(let h=0;h<f;h++)a[e+h]=d[h];}else a.push(d);}}function w(a,b){this.type=a;this.g=this.target=b;this.defaultPrevented=!1;}w.prototype.h=function(){this.defaultPrevented=!0;};var oa=function(){if(!l.addEventListener||!Object.defineProperty)return !1;var a=!1,b=Object.defineProperty({},"passive",{get:function(){a=!0;}});try{l.addEventListener("test",aa,b),l.removeEventListener("test",aa,b);}catch(c){}return a}();function pa$1(a){return /^[\s\xa0]*$/.test(a)}var qa=String.prototype.trim?function(a){return a.trim()}:function(a){return /^[\s\xa0]*([\s\S]*?)[\s\xa0]*$/.exec(a)[1]};function ra(a,b){return a<b?-1:a>b?1:0}function sa(){var a=l.navigator;return a&&(a=a.userAgent)?a:""}function x$1(a){return -1!=sa().indexOf(a)}function ta(a){ta[" "](a);return a}ta[" "]=aa;function ua(a){var b=va;return Object.prototype.hasOwnProperty.call(b,9)?b[9]:b[9]=a(9)}var wa$1=x$1("Opera"),y=x$1("Trident")||x$1("MSIE"),xa=x$1("Edge"),ya$1=xa||y,za=x$1("Gecko")&&!(-1!=sa().toLowerCase().indexOf("webkit")&&!x$1("Edge"))&&!(x$1("Trident")||x$1("MSIE"))&&!x$1("Edge"),Aa$1=-1!=sa().toLowerCase().indexOf("webkit")&&!x$1("Edge");function Ba(){var a=l.document;return a?a.documentMode:void 0}var Ea$1;
    a:{var Fa$1="",Ga=function(){var a=sa();if(za)return /rv:([^\);]+)(\)|;)/.exec(a);if(xa)return /Edge\/([\d\.]+)/.exec(a);if(y)return /\b(?:MSIE|rv)[: ]([^\);]+)(\)|;)/.exec(a);if(Aa$1)return /WebKit\/(\S+)/.exec(a);if(wa$1)return /(?:Version)[ \/]?(\S+)/.exec(a)}();Ga&&(Fa$1=Ga?Ga[1]:"");if(y){var Ha$1=Ba();if(null!=Ha$1&&Ha$1>parseFloat(Fa$1)){Ea$1=String(Ha$1);break a}}Ea$1=Fa$1;}var va={};
    function Ia(){return ua(function(){let a=0;const b=qa(String(Ea$1)).split("."),c=qa("9").split("."),d=Math.max(b.length,c.length);for(let h=0;0==a&&h<d;h++){var e=b[h]||"",f=c[h]||"";do{e=/(\d*)(\D*)(.*)/.exec(e)||["","","",""];f=/(\d*)(\D*)(.*)/.exec(f)||["","","",""];if(0==e[0].length&&0==f[0].length)break;a=ra(0==e[1].length?0:parseInt(e[1],10),0==f[1].length?0:parseInt(f[1],10))||ra(0==e[2].length,0==f[2].length)||ra(e[2],f[2]);e=e[3];f=f[3];}while(0==a)}return 0<=a})}var Ja;
    if(l.document&&y){var Ka=Ba();Ja=Ka?Ka:parseInt(Ea$1,10)||void 0;}else Ja=void 0;var La=Ja;function z$1(a,b){w.call(this,a?a.type:"");this.relatedTarget=this.g=this.target=null;this.button=this.screenY=this.screenX=this.clientY=this.clientX=0;this.key="";this.metaKey=this.shiftKey=this.altKey=this.ctrlKey=!1;this.state=null;this.pointerId=0;this.pointerType="";this.i=null;if(a){var c=this.type=a.type,d=a.changedTouches&&a.changedTouches.length?a.changedTouches[0]:null;this.target=a.target||a.srcElement;this.g=b;if(b=a.relatedTarget){if(za){a:{try{ta(b.nodeName);var e=!0;break a}catch(f){}e=
    !1;}e||(b=null);}}else "mouseover"==c?b=a.fromElement:"mouseout"==c&&(b=a.toElement);this.relatedTarget=b;d?(this.clientX=void 0!==d.clientX?d.clientX:d.pageX,this.clientY=void 0!==d.clientY?d.clientY:d.pageY,this.screenX=d.screenX||0,this.screenY=d.screenY||0):(this.clientX=void 0!==a.clientX?a.clientX:a.pageX,this.clientY=void 0!==a.clientY?a.clientY:a.pageY,this.screenX=a.screenX||0,this.screenY=a.screenY||0);this.button=a.button;this.key=a.key||"";this.ctrlKey=a.ctrlKey;this.altKey=a.altKey;this.shiftKey=
    a.shiftKey;this.metaKey=a.metaKey;this.pointerId=a.pointerId||0;this.pointerType="string"===typeof a.pointerType?a.pointerType:Ma$1[a.pointerType]||"";this.state=a.state;this.i=a;a.defaultPrevented&&z$1.X.h.call(this);}}t(z$1,w);var Ma$1={2:"touch",3:"pen",4:"mouse"};z$1.prototype.h=function(){z$1.X.h.call(this);var a=this.i;a.preventDefault?a.preventDefault():a.returnValue=!1;};var A="closure_listenable_"+(1E6*Math.random()|0);var Na$1=0;function Oa$1(a,b,c,d,e){this.listener=a;this.proxy=null;this.src=b;this.type=c;this.capture=!!d;this.ha=e;this.key=++Na$1;this.ba=this.ea=!1;}function Pa$1(a){a.ba=!0;a.listener=null;a.proxy=null;a.src=null;a.ha=null;}function Qa(a,b,c){for(const d in a)b.call(c,a[d],d,a);}function Ra$1(a){const b={};for(const c in a)b[c]=a[c];return b}const Sa$1="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");function Ta$1(a,b){let c,d;for(let e=1;e<arguments.length;e++){d=arguments[e];for(c in d)a[c]=d[c];for(let f=0;f<Sa$1.length;f++)c=Sa$1[f],Object.prototype.hasOwnProperty.call(d,c)&&(a[c]=d[c]);}}function Ua(a){this.src=a;this.g={};this.h=0;}Ua.prototype.add=function(a,b,c,d,e){var f=a.toString();a=this.g[f];a||(a=this.g[f]=[],this.h++);var h=Va(a,b,d,e);-1<h?(b=a[h],c||(b.ea=!1)):(b=new Oa$1(b,this.src,f,!!d,e),b.ea=c,a.push(b));return b};function Wa(a,b){var c=b.type;if(c in a.g){var d=a.g[c],e=la$1(d,b),f;(f=0<=e)&&Array.prototype.splice.call(d,e,1);f&&(Pa$1(b),0==a.g[c].length&&(delete a.g[c],a.h--));}}
    function Va(a,b,c,d){for(var e=0;e<a.length;++e){var f=a[e];if(!f.ba&&f.listener==b&&f.capture==!!c&&f.ha==d)return e}return -1}var Xa$1="closure_lm_"+(1E6*Math.random()|0),Ya$1={};function $a(a,b,c,d,e){if(d&&d.once)return ab(a,b,c,d,e);if(Array.isArray(b)){for(var f=0;f<b.length;f++)$a(a,b[f],c,d,e);return null}c=bb(c);return a&&a[A]?a.N(b,c,p(d)?!!d.capture:!!d,e):cb(a,b,c,!1,d,e)}
    function cb(a,b,c,d,e,f){if(!b)throw Error("Invalid event type");var h=p(e)?!!e.capture:!!e,n=db(a);n||(a[Xa$1]=n=new Ua(a));c=n.add(b,c,d,h,f);if(c.proxy)return c;d=eb();c.proxy=d;d.src=a;d.listener=c;if(a.addEventListener)oa||(e=h),void 0===e&&(e=!1),a.addEventListener(b.toString(),d,e);else if(a.attachEvent)a.attachEvent(fb(b.toString()),d);else if(a.addListener&&a.removeListener)a.addListener(d);else throw Error("addEventListener and attachEvent are unavailable.");return c}
    function eb(){function a(c){return b.call(a.src,a.listener,c)}const b=gb;return a}function ab(a,b,c,d,e){if(Array.isArray(b)){for(var f=0;f<b.length;f++)ab(a,b[f],c,d,e);return null}c=bb(c);return a&&a[A]?a.O(b,c,p(d)?!!d.capture:!!d,e):cb(a,b,c,!0,d,e)}
    function hb(a,b,c,d,e){if(Array.isArray(b))for(var f=0;f<b.length;f++)hb(a,b[f],c,d,e);else (d=p(d)?!!d.capture:!!d,c=bb(c),a&&a[A])?(a=a.i,b=String(b).toString(),b in a.g&&(f=a.g[b],c=Va(f,c,d,e),-1<c&&(Pa$1(f[c]),Array.prototype.splice.call(f,c,1),0==f.length&&(delete a.g[b],a.h--)))):a&&(a=db(a))&&(b=a.g[b.toString()],a=-1,b&&(a=Va(b,c,d,e)),(c=-1<a?b[a]:null)&&ib(c));}
    function ib(a){if("number"!==typeof a&&a&&!a.ba){var b=a.src;if(b&&b[A])Wa(b.i,a);else {var c=a.type,d=a.proxy;b.removeEventListener?b.removeEventListener(c,d,a.capture):b.detachEvent?b.detachEvent(fb(c),d):b.addListener&&b.removeListener&&b.removeListener(d);(c=db(b))?(Wa(c,a),0==c.h&&(c.src=null,b[Xa$1]=null)):Pa$1(a);}}}function fb(a){return a in Ya$1?Ya$1[a]:Ya$1[a]="on"+a}function gb(a,b){if(a.ba)a=!0;else {b=new z$1(b,this);var c=a.listener,d=a.ha||a.src;a.ea&&ib(a);a=c.call(d,b);}return a}
    function db(a){a=a[Xa$1];return a instanceof Ua?a:null}var jb="__closure_events_fn_"+(1E9*Math.random()>>>0);function bb(a){if("function"===typeof a)return a;a[jb]||(a[jb]=function(b){return a.handleEvent(b)});return a[jb]}function B$1(){v$1.call(this);this.i=new Ua(this);this.P=this;this.I=null;}t(B$1,v$1);B$1.prototype[A]=!0;B$1.prototype.removeEventListener=function(a,b,c,d){hb(this,a,b,c,d);};
    function C$1(a,b){var c,d=a.I;if(d)for(c=[];d;d=d.I)c.push(d);a=a.P;d=b.type||b;if("string"===typeof b)b=new w(b,a);else if(b instanceof w)b.target=b.target||a;else {var e=b;b=new w(d,a);Ta$1(b,e);}e=!0;if(c)for(var f=c.length-1;0<=f;f--){var h=b.g=c[f];e=kb(h,d,!0,b)&&e;}h=b.g=a;e=kb(h,d,!0,b)&&e;e=kb(h,d,!1,b)&&e;if(c)for(f=0;f<c.length;f++)h=b.g=c[f],e=kb(h,d,!1,b)&&e;}
    B$1.prototype.M=function(){B$1.X.M.call(this);if(this.i){var a=this.i,c;for(c in a.g){for(var d=a.g[c],e=0;e<d.length;e++)Pa$1(d[e]);delete a.g[c];a.h--;}}this.I=null;};B$1.prototype.N=function(a,b,c,d){return this.i.add(String(a),b,!1,c,d)};B$1.prototype.O=function(a,b,c,d){return this.i.add(String(a),b,!0,c,d)};
    function kb(a,b,c,d){b=a.i.g[String(b)];if(!b)return !0;b=b.concat();for(var e=!0,f=0;f<b.length;++f){var h=b[f];if(h&&!h.ba&&h.capture==c){var n=h.listener,u=h.ha||h.src;h.ea&&Wa(a.i,h);e=!1!==n.call(u,d)&&e;}}return e&&!d.defaultPrevented}var lb=l.JSON.stringify;function mb(){var a=nb;let b=null;a.g&&(b=a.g,a.g=a.g.next,a.g||(a.h=null),b.next=null);return b}class ob{constructor(){this.h=this.g=null;}add(a,b){const c=pb.get();c.set(a,b);this.h?this.h.next=c:this.g=c;this.h=c;}}var pb=new class{constructor(a,b){this.i=a;this.j=b;this.h=0;this.g=null;}get(){let a;0<this.h?(this.h--,a=this.g,this.g=a.next,a.next=null):a=this.i();return a}}(()=>new qb,a=>a.reset());
    class qb{constructor(){this.next=this.g=this.h=null;}set(a,b){this.h=a;this.g=b;this.next=null;}reset(){this.next=this.g=this.h=null;}}function rb(a){l.setTimeout(()=>{throw a;},0);}function sb(a,b){ub||vb();wb||(ub(),wb=!0);nb.add(a,b);}var ub;function vb(){var a=l.Promise.resolve(void 0);ub=function(){a.then(xb);};}var wb=!1,nb=new ob;function xb(){for(var a;a=mb();){try{a.h.call(a.g);}catch(c){rb(c);}var b=pb;b.j(a);100>b.h&&(b.h++,a.next=b.g,b.g=a);}wb=!1;}function yb(a,b){B$1.call(this);this.h=a||1;this.g=b||l;this.j=q$1(this.kb,this);this.l=Date.now();}t(yb,B$1);k$1=yb.prototype;k$1.ca=!1;k$1.R=null;k$1.kb=function(){if(this.ca){var a=Date.now()-this.l;0<a&&a<.8*this.h?this.R=this.g.setTimeout(this.j,this.h-a):(this.R&&(this.g.clearTimeout(this.R),this.R=null),C$1(this,"tick"),this.ca&&(zb(this),this.start()));}};k$1.start=function(){this.ca=!0;this.R||(this.R=this.g.setTimeout(this.j,this.h),this.l=Date.now());};
    function zb(a){a.ca=!1;a.R&&(a.g.clearTimeout(a.R),a.R=null);}k$1.M=function(){yb.X.M.call(this);zb(this);delete this.g;};function Ab(a,b,c){if("function"===typeof a)c&&(a=q$1(a,c));else if(a&&"function"==typeof a.handleEvent)a=q$1(a.handleEvent,a);else throw Error("Invalid listener argument");return 2147483647<Number(b)?-1:l.setTimeout(a,b||0)}function Bb(a){a.g=Ab(()=>{a.g=null;a.i&&(a.i=!1,Bb(a));},a.j);const b=a.h;a.h=null;a.m.apply(null,b);}class Cb extends v$1{constructor(a,b){super();this.m=a;this.j=b;this.h=null;this.i=!1;this.g=null;}l(a){this.h=arguments;this.g?this.i=!0:Bb(this);}M(){super.M();this.g&&(l.clearTimeout(this.g),this.g=null,this.i=!1,this.h=null);}}function D$1(a){v$1.call(this);this.h=a;this.g={};}t(D$1,v$1);var Db=[];function Eb(a,b,c,d){Array.isArray(c)||(c&&(Db[0]=c.toString()),c=Db);for(var e=0;e<c.length;e++){var f=$a(b,c[e],d||a.handleEvent,!1,a.h||a);if(!f)break;a.g[f.key]=f;}}function Fb(a){Qa(a.g,function(b,c){this.g.hasOwnProperty(c)&&ib(b);},a);a.g={};}D$1.prototype.M=function(){D$1.X.M.call(this);Fb(this);};D$1.prototype.handleEvent=function(){throw Error("EventHandler.handleEvent not implemented");};function Gb(){this.g=!0;}Gb.prototype.Aa=function(){this.g=!1;};function Hb(a,b,c,d,e,f){a.info(function(){if(a.g)if(f){var h="";for(var n=f.split("&"),u=0;u<n.length;u++){var m=n[u].split("=");if(1<m.length){var r=m[0];m=m[1];var F=r.split("_");h=2<=F.length&&"type"==F[1]?h+(r+"="+m+"&"):h+(r+"=redacted&");}}}else h=null;else h=f;return "XMLHTTP REQ ("+d+") [attempt "+e+"]: "+b+"\n"+c+"\n"+h});}
    function Ib(a,b,c,d,e,f,h){a.info(function(){return "XMLHTTP RESP ("+d+") [ attempt "+e+"]: "+b+"\n"+c+"\n"+f+" "+h});}function E(a,b,c,d){a.info(function(){return "XMLHTTP TEXT ("+b+"): "+Jb(a,c)+(d?" "+d:"")});}function Kb(a,b){a.info(function(){return "TIMEOUT: "+b});}Gb.prototype.info=function(){};
    function Jb(a,b){if(!a.g)return b;if(!b)return null;try{var c=JSON.parse(b);if(c)for(a=0;a<c.length;a++)if(Array.isArray(c[a])){var d=c[a];if(!(2>d.length)){var e=d[1];if(Array.isArray(e)&&!(1>e.length)){var f=e[0];if("noop"!=f&&"stop"!=f&&"close"!=f)for(var h=1;h<e.length;h++)e[h]="";}}}return lb(c)}catch(n){return b}}var G$1={},Lb=null;function Mb(){return Lb=Lb||new B$1}G$1.Oa="serverreachability";function Nb(a){w.call(this,G$1.Oa,a);}t(Nb,w);function H(a){const b=Mb();C$1(b,new Nb(b));}G$1.STAT_EVENT="statevent";function Ob(a,b){w.call(this,G$1.STAT_EVENT,a);this.stat=b;}t(Ob,w);function I(a){const b=Mb();C$1(b,new Ob(b,a));}G$1.Pa="timingevent";function Pb(a,b){w.call(this,G$1.Pa,a);this.size=b;}t(Pb,w);
    function J$1(a,b){if("function"!==typeof a)throw Error("Fn must not be null and must be a function");return l.setTimeout(function(){a();},b)}var Qb={NO_ERROR:0,lb:1,yb:2,xb:3,sb:4,wb:5,zb:6,La:7,TIMEOUT:8,Cb:9};var Rb={qb:"complete",Mb:"success",Ma:"error",La:"abort",Eb:"ready",Fb:"readystatechange",TIMEOUT:"timeout",Ab:"incrementaldata",Db:"progress",tb:"downloadprogress",Ub:"uploadprogress"};function Sb(){}Sb.prototype.h=null;function Tb(a){return a.h||(a.h=a.i())}function Ub(){}var K={OPEN:"a",pb:"b",Ma:"c",Bb:"d"};function Vb(){w.call(this,"d");}t(Vb,w);function Wb(){w.call(this,"c");}t(Wb,w);var Xb;function Yb(){}t(Yb,Sb);Yb.prototype.g=function(){return new XMLHttpRequest};Yb.prototype.i=function(){return {}};Xb=new Yb;function L$1(a,b,c,d){this.l=a;this.j=b;this.m=c;this.U=d||1;this.S=new D$1(this);this.O=Zb;a=ya$1?125:void 0;this.T=new yb(a);this.H=null;this.i=!1;this.s=this.A=this.v=this.K=this.F=this.V=this.B=null;this.D=[];this.g=null;this.C=0;this.o=this.u=null;this.Y=-1;this.I=!1;this.N=0;this.L=null;this.$=this.J=this.Z=this.P=!1;this.h=new $b;}function $b(){this.i=null;this.g="";this.h=!1;}var Zb=45E3,ac$1={},bc={};k$1=L$1.prototype;k$1.setTimeout=function(a){this.O=a;};
    function cc$1(a,b,c){a.K=1;a.v=dc$1(M$1(b));a.s=c;a.P=!0;ec$1(a,null);}function ec$1(a,b){a.F=Date.now();N$1(a);a.A=M$1(a.v);var c=a.A,d=a.U;Array.isArray(d)||(d=[String(d)]);fc(c.i,"t",d);a.C=0;c=a.l.H;a.h=new $b;a.g=gc$1(a.l,c?b:null,!a.s);0<a.N&&(a.L=new Cb(q$1(a.Ka,a,a.g),a.N));Eb(a.S,a.g,"readystatechange",a.hb);b=a.H?Ra$1(a.H):{};a.s?(a.u||(a.u="POST"),b["Content-Type"]="application/x-www-form-urlencoded",a.g.da(a.A,a.u,a.s,b)):(a.u="GET",a.g.da(a.A,a.u,null,b));H();Hb(a.j,a.u,a.A,a.m,a.U,a.s);}
    k$1.hb=function(a){a=a.target;const b=this.L;b&&3==O(a)?b.l():this.Ka(a);};
    k$1.Ka=function(a){try{if(a==this.g)a:{const r=O(this.g);var b=this.g.Ea();const F=this.g.aa();if(!(3>r)&&(3!=r||ya$1||this.g&&(this.h.h||this.g.fa()||hc$1(this.g)))){this.I||4!=r||7==b||(8==b||0>=F?H(3):H(2));ic$1(this);var c=this.g.aa();this.Y=c;b:if(jc$1(this)){var d=hc$1(this.g);a="";var e=d.length,f=4==O(this.g);if(!this.h.i){if("undefined"===typeof TextDecoder){P$1(this);Q$1(this);var h="";break b}this.h.i=new l.TextDecoder;}for(b=0;b<e;b++)this.h.h=!0,a+=this.h.i.decode(d[b],{stream:f&&b==e-1});d.splice(0,
    e);this.h.g+=a;this.C=0;h=this.h.g;}else h=this.g.fa();this.i=200==c;Ib(this.j,this.u,this.A,this.m,this.U,r,c);if(this.i){if(this.Z&&!this.J){b:{if(this.g){var n,u=this.g;if((n=u.g?u.g.getResponseHeader("X-HTTP-Initial-Response"):null)&&!pa$1(n)){var m=n;break b}}m=null;}if(c=m)E(this.j,this.m,c,"Initial handshake response via X-HTTP-Initial-Response"),this.J=!0,kc(this,c);else {this.i=!1;this.o=3;I(12);P$1(this);Q$1(this);break a}}this.P?(lc$1(this,r,h),ya$1&&this.i&&3==r&&(Eb(this.S,this.T,"tick",this.gb),
    this.T.start())):(E(this.j,this.m,h,null),kc(this,h));4==r&&P$1(this);this.i&&!this.I&&(4==r?mc$1(this.l,this):(this.i=!1,N$1(this)));}else 400==c&&0<h.indexOf("Unknown SID")?(this.o=3,I(12)):(this.o=0,I(13)),P$1(this),Q$1(this);}}}catch(r){}finally{}};function jc$1(a){return a.g?"GET"==a.u&&2!=a.K&&a.l.Da:!1}
    function lc$1(a,b,c){let d=!0,e;for(;!a.I&&a.C<c.length;)if(e=nc$1(a,c),e==bc){4==b&&(a.o=4,I(14),d=!1);E(a.j,a.m,null,"[Incomplete Response]");break}else if(e==ac$1){a.o=4;I(15);E(a.j,a.m,c,"[Invalid Chunk]");d=!1;break}else E(a.j,a.m,e,null),kc(a,e);jc$1(a)&&e!=bc&&e!=ac$1&&(a.h.g="",a.C=0);4!=b||0!=c.length||a.h.h||(a.o=1,I(16),d=!1);a.i=a.i&&d;d?0<c.length&&!a.$&&(a.$=!0,b=a.l,b.g==a&&b.$&&!b.K&&(b.j.info("Great, no buffering proxy detected. Bytes received: "+c.length),oc$1(b),b.K=!0,I(11))):(E(a.j,a.m,c,
    "[Invalid Chunked Response]"),P$1(a),Q$1(a));}k$1.gb=function(){if(this.g){var a=O(this.g),b=this.g.fa();this.C<b.length&&(ic$1(this),lc$1(this,a,b),this.i&&4!=a&&N$1(this));}};function nc$1(a,b){var c=a.C,d=b.indexOf("\n",c);if(-1==d)return bc;c=Number(b.substring(c,d));if(isNaN(c))return ac$1;d+=1;if(d+c>b.length)return bc;b=b.substr(d,c);a.C=d+c;return b}k$1.cancel=function(){this.I=!0;P$1(this);};function N$1(a){a.V=Date.now()+a.O;pc$1(a,a.O);}
    function pc$1(a,b){if(null!=a.B)throw Error("WatchDog timer not null");a.B=J$1(q$1(a.fb,a),b);}function ic$1(a){a.B&&(l.clearTimeout(a.B),a.B=null);}k$1.fb=function(){this.B=null;const a=Date.now();0<=a-this.V?(Kb(this.j,this.A),2!=this.K&&(H(),I(17)),P$1(this),this.o=2,Q$1(this)):pc$1(this,this.V-a);};function Q$1(a){0==a.l.G||a.I||mc$1(a.l,a);}function P$1(a){ic$1(a);var b=a.L;b&&"function"==typeof b.na&&b.na();a.L=null;zb(a.T);Fb(a.S);a.g&&(b=a.g,a.g=null,b.abort(),b.na());}
    function kc(a,b){try{var c=a.l;if(0!=c.G&&(c.g==a||qc(c.h,a)))if(!a.J&&qc(c.h,a)&&3==c.G){try{var d=c.Fa.g.parse(b);}catch(m){d=null;}if(Array.isArray(d)&&3==d.length){var e=d;if(0==e[0])a:{if(!c.u){if(c.g)if(c.g.F+3E3<a.F)rc$1(c),sc$1(c);else break a;tc$1(c);I(18);}}else c.Ba=e[1],0<c.Ba-c.T&&37500>e[2]&&c.L&&0==c.A&&!c.v&&(c.v=J$1(q$1(c.bb,c),6E3));if(1>=uc$1(c.h)&&c.ja){try{c.ja();}catch(m){}c.ja=void 0;}}else R$1(c,11);}else if((a.J||c.g==a)&&rc$1(c),!pa$1(b))for(e=c.Fa.g.parse(b),b=0;b<e.length;b++){let m=e[b];c.T=
    m[0];m=m[1];if(2==c.G)if("c"==m[0]){c.I=m[1];c.ka=m[2];const r=m[3];null!=r&&(c.ma=r,c.j.info("VER="+c.ma));const F=m[4];null!=F&&(c.Ca=F,c.j.info("SVER="+c.Ca));const Ca=m[5];null!=Ca&&"number"===typeof Ca&&0<Ca&&(d=1.5*Ca,c.J=d,c.j.info("backChannelRequestTimeoutMs_="+d));d=c;const Z=a.g;if(Z){const Da=Z.g?Z.g.getResponseHeader("X-Client-Wire-Protocol"):null;if(Da){var f=d.h;f.g||-1==Da.indexOf("spdy")&&-1==Da.indexOf("quic")&&-1==Da.indexOf("h2")||(f.j=f.l,f.g=new Set,f.h&&(vc(f,f.h),f.h=null));}if(d.D){const tb=
    Z.g?Z.g.getResponseHeader("X-HTTP-Session-Id"):null;tb&&(d.za=tb,S(d.F,d.D,tb));}}c.G=3;c.l&&c.l.xa();c.$&&(c.P=Date.now()-a.F,c.j.info("Handshake RTT: "+c.P+"ms"));d=c;var h=a;d.sa=wc$1(d,d.H?d.ka:null,d.V);if(h.J){xc$1(d.h,h);var n=h,u=d.J;u&&n.setTimeout(u);n.B&&(ic$1(n),N$1(n));d.g=h;}else yc$1(d);0<c.i.length&&zc$1(c);}else "stop"!=m[0]&&"close"!=m[0]||R$1(c,7);else 3==c.G&&("stop"==m[0]||"close"==m[0]?"stop"==m[0]?R$1(c,7):Ac(c):"noop"!=m[0]&&c.l&&c.l.wa(m),c.A=0);}H(4);}catch(m){}}function Bc(a){if(a.W&&"function"==typeof a.W)return a.W();if("undefined"!==typeof Map&&a instanceof Map||"undefined"!==typeof Set&&a instanceof Set)return Array.from(a.values());if("string"===typeof a)return a.split("");if(ba(a)){for(var b=[],c=a.length,d=0;d<c;d++)b.push(a[d]);return b}b=[];c=0;for(d in a)b[c++]=a[d];return b}
    function Cc(a){if(a.oa&&"function"==typeof a.oa)return a.oa();if(!a.W||"function"!=typeof a.W){if("undefined"!==typeof Map&&a instanceof Map)return Array.from(a.keys());if(!("undefined"!==typeof Set&&a instanceof Set)){if(ba(a)||"string"===typeof a){var b=[];a=a.length;for(var c=0;c<a;c++)b.push(c);return b}b=[];c=0;for(const d in a)b[c++]=d;return b}}}
    function Dc(a,b){if(a.forEach&&"function"==typeof a.forEach)a.forEach(b,void 0);else if(ba(a)||"string"===typeof a)Array.prototype.forEach.call(a,b,void 0);else for(var c=Cc(a),d=Bc(a),e=d.length,f=0;f<e;f++)b.call(void 0,d[f],c&&c[f],a);}var Ec$1=RegExp("^(?:([^:/?#.]+):)?(?://(?:([^\\\\/?#]*)@)?([^\\\\/?#]*?)(?::([0-9]+))?(?=[\\\\/?#]|$))?([^?#]+)?(?:\\?([^#]*))?(?:#([\\s\\S]*))?$");function Fc(a,b){if(a){a=a.split("&");for(var c=0;c<a.length;c++){var d=a[c].indexOf("="),e=null;if(0<=d){var f=a[c].substring(0,d);e=a[c].substring(d+1);}else f=a[c];b(f,e?decodeURIComponent(e.replace(/\+/g," ")):"");}}}function T(a,b){this.g=this.s=this.j="";this.m=null;this.o=this.l="";this.h=!1;if(a instanceof T){this.h=void 0!==b?b:a.h;Gc$1(this,a.j);this.s=a.s;this.g=a.g;Hc(this,a.m);this.l=a.l;b=a.i;var c=new Ic$1;c.i=b.i;b.g&&(c.g=new Map(b.g),c.h=b.h);Jc(this,c);this.o=a.o;}else a&&(c=String(a).match(Ec$1))?(this.h=!!b,Gc$1(this,c[1]||"",!0),this.s=Kc(c[2]||""),this.g=Kc(c[3]||"",!0),Hc(this,c[4]),this.l=Kc(c[5]||"",!0),Jc(this,c[6]||"",!0),this.o=Kc(c[7]||"")):(this.h=!!b,this.i=new Ic$1(null,this.h));}
    T.prototype.toString=function(){var a=[],b=this.j;b&&a.push(Lc$1(b,Mc$1,!0),":");var c=this.g;if(c||"file"==b)a.push("//"),(b=this.s)&&a.push(Lc$1(b,Mc$1,!0),"@"),a.push(encodeURIComponent(String(c)).replace(/%25([0-9a-fA-F]{2})/g,"%$1")),c=this.m,null!=c&&a.push(":",String(c));if(c=this.l)this.g&&"/"!=c.charAt(0)&&a.push("/"),a.push(Lc$1(c,"/"==c.charAt(0)?Nc$1:Oc,!0));(c=this.i.toString())&&a.push("?",c);(c=this.o)&&a.push("#",Lc$1(c,Pc));return a.join("")};function M$1(a){return new T(a)}
    function Gc$1(a,b,c){a.j=c?Kc(b,!0):b;a.j&&(a.j=a.j.replace(/:$/,""));}function Hc(a,b){if(b){b=Number(b);if(isNaN(b)||0>b)throw Error("Bad port number "+b);a.m=b;}else a.m=null;}function Jc(a,b,c){b instanceof Ic$1?(a.i=b,Qc$1(a.i,a.h)):(c||(b=Lc$1(b,Rc)),a.i=new Ic$1(b,a.h));}function S(a,b,c){a.i.set(b,c);}function dc$1(a){S(a,"zx",Math.floor(2147483648*Math.random()).toString(36)+Math.abs(Math.floor(2147483648*Math.random())^Date.now()).toString(36));return a}
    function Kc(a,b){return a?b?decodeURI(a.replace(/%25/g,"%2525")):decodeURIComponent(a):""}function Lc$1(a,b,c){return "string"===typeof a?(a=encodeURI(a).replace(b,Sc),c&&(a=a.replace(/%25([0-9a-fA-F]{2})/g,"%$1")),a):null}function Sc(a){a=a.charCodeAt(0);return "%"+(a>>4&15).toString(16)+(a&15).toString(16)}var Mc$1=/[#\/\?@]/g,Oc=/[#\?:]/g,Nc$1=/[#\?]/g,Rc=/[#\?@]/g,Pc=/#/g;function Ic$1(a,b){this.h=this.g=null;this.i=a||null;this.j=!!b;}
    function U$1(a){a.g||(a.g=new Map,a.h=0,a.i&&Fc(a.i,function(b,c){a.add(decodeURIComponent(b.replace(/\+/g," ")),c);}));}k$1=Ic$1.prototype;k$1.add=function(a,b){U$1(this);this.i=null;a=V$1(this,a);var c=this.g.get(a);c||this.g.set(a,c=[]);c.push(b);this.h+=1;return this};function Tc$1(a,b){U$1(a);b=V$1(a,b);a.g.has(b)&&(a.i=null,a.h-=a.g.get(b).length,a.g.delete(b));}function Uc(a,b){U$1(a);b=V$1(a,b);return a.g.has(b)}
    k$1.forEach=function(a,b){U$1(this);this.g.forEach(function(c,d){c.forEach(function(e){a.call(b,e,d,this);},this);},this);};k$1.oa=function(){U$1(this);const a=Array.from(this.g.values()),b=Array.from(this.g.keys()),c=[];for(let d=0;d<b.length;d++){const e=a[d];for(let f=0;f<e.length;f++)c.push(b[d]);}return c};k$1.W=function(a){U$1(this);let b=[];if("string"===typeof a)Uc(this,a)&&(b=b.concat(this.g.get(V$1(this,a))));else {a=Array.from(this.g.values());for(let c=0;c<a.length;c++)b=b.concat(a[c]);}return b};
    k$1.set=function(a,b){U$1(this);this.i=null;a=V$1(this,a);Uc(this,a)&&(this.h-=this.g.get(a).length);this.g.set(a,[b]);this.h+=1;return this};k$1.get=function(a,b){if(!a)return b;a=this.W(a);return 0<a.length?String(a[0]):b};function fc(a,b,c){Tc$1(a,b);0<c.length&&(a.i=null,a.g.set(V$1(a,b),ma$1(c)),a.h+=c.length);}
    k$1.toString=function(){if(this.i)return this.i;if(!this.g)return "";const a=[],b=Array.from(this.g.keys());for(var c=0;c<b.length;c++){var d=b[c];const f=encodeURIComponent(String(d)),h=this.W(d);for(d=0;d<h.length;d++){var e=f;""!==h[d]&&(e+="="+encodeURIComponent(String(h[d])));a.push(e);}}return this.i=a.join("&")};function V$1(a,b){b=String(b);a.j&&(b=b.toLowerCase());return b}
    function Qc$1(a,b){b&&!a.j&&(U$1(a),a.i=null,a.g.forEach(function(c,d){var e=d.toLowerCase();d!=e&&(Tc$1(this,d),fc(this,e,c));},a));a.j=b;}var Vc=class{constructor(a,b){this.h=a;this.g=b;}};function Wc$1(a){this.l=a||Xc$1;l.PerformanceNavigationTiming?(a=l.performance.getEntriesByType("navigation"),a=0<a.length&&("hq"==a[0].nextHopProtocol||"h2"==a[0].nextHopProtocol)):a=!!(l.g&&l.g.Ga&&l.g.Ga()&&l.g.Ga().Zb);this.j=a?this.l:1;this.g=null;1<this.j&&(this.g=new Set);this.h=null;this.i=[];}var Xc$1=10;function Yc(a){return a.h?!0:a.g?a.g.size>=a.j:!1}function uc$1(a){return a.h?1:a.g?a.g.size:0}function qc(a,b){return a.h?a.h==b:a.g?a.g.has(b):!1}function vc(a,b){a.g?a.g.add(b):a.h=b;}
    function xc$1(a,b){a.h&&a.h==b?a.h=null:a.g&&a.g.has(b)&&a.g.delete(b);}Wc$1.prototype.cancel=function(){this.i=Zc$1(this);if(this.h)this.h.cancel(),this.h=null;else if(this.g&&0!==this.g.size){for(const a of this.g.values())a.cancel();this.g.clear();}};function Zc$1(a){if(null!=a.h)return a.i.concat(a.h.D);if(null!=a.g&&0!==a.g.size){let b=a.i;for(const c of a.g.values())b=b.concat(c.D);return b}return ma$1(a.i)}function $c$1(){}$c$1.prototype.stringify=function(a){return l.JSON.stringify(a,void 0)};$c$1.prototype.parse=function(a){return l.JSON.parse(a,void 0)};function ad(){this.g=new $c$1;}function bd(a,b,c){const d=c||"";try{Dc(a,function(e,f){let h=e;p(e)&&(h=lb(e));b.push(d+f+"="+encodeURIComponent(h));});}catch(e){throw b.push(d+"type="+encodeURIComponent("_badmap")),e;}}function cd(a,b){const c=new Gb;if(l.Image){const d=new Image;d.onload=ia(dd,c,d,"TestLoadImage: loaded",!0,b);d.onerror=ia(dd,c,d,"TestLoadImage: error",!1,b);d.onabort=ia(dd,c,d,"TestLoadImage: abort",!1,b);d.ontimeout=ia(dd,c,d,"TestLoadImage: timeout",!1,b);l.setTimeout(function(){if(d.ontimeout)d.ontimeout();},1E4);d.src=a;}else b(!1);}function dd(a,b,c,d,e){try{b.onload=null,b.onerror=null,b.onabort=null,b.ontimeout=null,e(d);}catch(f){}}function ed(a){this.l=a.$b||null;this.j=a.ib||!1;}t(ed,Sb);ed.prototype.g=function(){return new fd(this.l,this.j)};ed.prototype.i=function(a){return function(){return a}}({});function fd(a,b){B$1.call(this);this.D=a;this.u=b;this.m=void 0;this.readyState=gd;this.status=0;this.responseType=this.responseText=this.response=this.statusText="";this.onreadystatechange=null;this.v=new Headers;this.h=null;this.C="GET";this.B="";this.g=!1;this.A=this.j=this.l=null;}t(fd,B$1);var gd=0;k$1=fd.prototype;
    k$1.open=function(a,b){if(this.readyState!=gd)throw this.abort(),Error("Error reopening a connection");this.C=a;this.B=b;this.readyState=1;hd(this);};k$1.send=function(a){if(1!=this.readyState)throw this.abort(),Error("need to call open() first. ");this.g=!0;const b={headers:this.v,method:this.C,credentials:this.m,cache:void 0};a&&(b.body=a);(this.D||l).fetch(new Request(this.B,b)).then(this.Va.bind(this),this.ga.bind(this));};
    k$1.abort=function(){this.response=this.responseText="";this.v=new Headers;this.status=0;this.j&&this.j.cancel("Request was aborted.").catch(()=>{});1<=this.readyState&&this.g&&4!=this.readyState&&(this.g=!1,id(this));this.readyState=gd;};
    k$1.Va=function(a){if(this.g&&(this.l=a,this.h||(this.status=this.l.status,this.statusText=this.l.statusText,this.h=a.headers,this.readyState=2,hd(this)),this.g&&(this.readyState=3,hd(this),this.g)))if("arraybuffer"===this.responseType)a.arrayBuffer().then(this.Ta.bind(this),this.ga.bind(this));else if("undefined"!==typeof l.ReadableStream&&"body"in a){this.j=a.body.getReader();if(this.u){if(this.responseType)throw Error('responseType must be empty for "streamBinaryChunks" mode responses.');this.response=
    [];}else this.response=this.responseText="",this.A=new TextDecoder;jd(this);}else a.text().then(this.Ua.bind(this),this.ga.bind(this));};function jd(a){a.j.read().then(a.Sa.bind(a)).catch(a.ga.bind(a));}k$1.Sa=function(a){if(this.g){if(this.u&&a.value)this.response.push(a.value);else if(!this.u){var b=a.value?a.value:new Uint8Array(0);if(b=this.A.decode(b,{stream:!a.done}))this.response=this.responseText+=b;}a.done?id(this):hd(this);3==this.readyState&&jd(this);}};
    k$1.Ua=function(a){this.g&&(this.response=this.responseText=a,id(this));};k$1.Ta=function(a){this.g&&(this.response=a,id(this));};k$1.ga=function(){this.g&&id(this);};function id(a){a.readyState=4;a.l=null;a.j=null;a.A=null;hd(a);}k$1.setRequestHeader=function(a,b){this.v.append(a,b);};k$1.getResponseHeader=function(a){return this.h?this.h.get(a.toLowerCase())||"":""};
    k$1.getAllResponseHeaders=function(){if(!this.h)return "";const a=[],b=this.h.entries();for(var c=b.next();!c.done;)c=c.value,a.push(c[0]+": "+c[1]),c=b.next();return a.join("\r\n")};function hd(a){a.onreadystatechange&&a.onreadystatechange.call(a);}Object.defineProperty(fd.prototype,"withCredentials",{get:function(){return "include"===this.m},set:function(a){this.m=a?"include":"same-origin";}});var kd=l.JSON.parse;function W$1(a){B$1.call(this);this.headers=new Map;this.u=a||null;this.h=!1;this.C=this.g=null;this.H="";this.m=0;this.j="";this.l=this.F=this.v=this.D=!1;this.B=0;this.A=null;this.J=ld;this.K=this.L=!1;}t(W$1,B$1);var ld="",md=/^https?$/i,nd=["POST","PUT"];k$1=W$1.prototype;
    k$1.da=function(a,b,c,d){if(this.g)throw Error("[goog.net.XhrIo] Object is active with another request="+this.H+"; newUri="+a);b=b?b.toUpperCase():"GET";this.H=a;this.j="";this.m=0;this.D=!1;this.h=!0;this.g=this.u?this.u.g():Xb.g();this.C=this.u?Tb(this.u):Tb(Xb);this.g.onreadystatechange=q$1(this.Ha,this);try{this.F=!0,this.g.open(b,String(a),!0),this.F=!1;}catch(f){od(this,f);return}a=c||"";c=new Map(this.headers);if(d)if(Object.getPrototypeOf(d)===Object.prototype)for(var e in d)c.set(e,d[e]);else if("function"===
    typeof d.keys&&"function"===typeof d.get)for(const f of d.keys())c.set(f,d.get(f));else throw Error("Unknown input type for opt_headers: "+String(d));d=Array.from(c.keys()).find(f=>"content-type"==f.toLowerCase());e=l.FormData&&a instanceof l.FormData;!(0<=la$1(nd,b))||d||e||c.set("Content-Type","application/x-www-form-urlencoded;charset=utf-8");for(const [f,h]of c)this.g.setRequestHeader(f,h);this.J&&(this.g.responseType=this.J);"withCredentials"in this.g&&this.g.withCredentials!==this.L&&(this.g.withCredentials=
    this.L);try{pd(this),0<this.B&&((this.K=qd(this.g))?(this.g.timeout=this.B,this.g.ontimeout=q$1(this.qa,this)):this.A=Ab(this.qa,this.B,this)),this.v=!0,this.g.send(a),this.v=!1;}catch(f){od(this,f);}};function qd(a){return y&&Ia()&&"number"===typeof a.timeout&&void 0!==a.ontimeout}k$1.qa=function(){"undefined"!=typeof goog&&this.g&&(this.j="Timed out after "+this.B+"ms, aborting",this.m=8,C$1(this,"timeout"),this.abort(8));};
    function od(a,b){a.h=!1;a.g&&(a.l=!0,a.g.abort(),a.l=!1);a.j=b;a.m=5;rd(a);sd(a);}function rd(a){a.D||(a.D=!0,C$1(a,"complete"),C$1(a,"error"));}k$1.abort=function(a){this.g&&this.h&&(this.h=!1,this.l=!0,this.g.abort(),this.l=!1,this.m=a||7,C$1(this,"complete"),C$1(this,"abort"),sd(this));};k$1.M=function(){this.g&&(this.h&&(this.h=!1,this.l=!0,this.g.abort(),this.l=!1),sd(this,!0));W$1.X.M.call(this);};k$1.Ha=function(){this.s||(this.F||this.v||this.l?td(this):this.eb());};k$1.eb=function(){td(this);};
    function td(a){if(a.h&&"undefined"!=typeof goog&&(!a.C[1]||4!=O(a)||2!=a.aa()))if(a.v&&4==O(a))Ab(a.Ha,0,a);else if(C$1(a,"readystatechange"),4==O(a)){a.h=!1;try{const n=a.aa();a:switch(n){case 200:case 201:case 202:case 204:case 206:case 304:case 1223:var b=!0;break a;default:b=!1;}var c;if(!(c=b)){var d;if(d=0===n){var e=String(a.H).match(Ec$1)[1]||null;if(!e&&l.self&&l.self.location){var f=l.self.location.protocol;e=f.substr(0,f.length-1);}d=!md.test(e?e.toLowerCase():"");}c=d;}if(c)C$1(a,"complete"),C$1(a,
    "success");else {a.m=6;try{var h=2<O(a)?a.g.statusText:"";}catch(u){h="";}a.j=h+" ["+a.aa()+"]";rd(a);}}finally{sd(a);}}}function sd(a,b){if(a.g){pd(a);const c=a.g,d=a.C[0]?aa:null;a.g=null;a.C=null;b||C$1(a,"ready");try{c.onreadystatechange=d;}catch(e){}}}function pd(a){a.g&&a.K&&(a.g.ontimeout=null);a.A&&(l.clearTimeout(a.A),a.A=null);}function O(a){return a.g?a.g.readyState:0}k$1.aa=function(){try{return 2<O(this)?this.g.status:-1}catch(a){return -1}};
    k$1.fa=function(){try{return this.g?this.g.responseText:""}catch(a){return ""}};k$1.Ra=function(a){if(this.g){var b=this.g.responseText;a&&0==b.indexOf(a)&&(b=b.substring(a.length));return kd(b)}};function hc$1(a){try{if(!a.g)return null;if("response"in a.g)return a.g.response;switch(a.J){case ld:case "text":return a.g.responseText;case "arraybuffer":if("mozResponseArrayBuffer"in a.g)return a.g.mozResponseArrayBuffer}return null}catch(b){return null}}k$1.Ea=function(){return this.m};
    k$1.Na=function(){return "string"===typeof this.j?this.j:String(this.j)};function ud(a){let b="";Qa(a,function(c,d){b+=d;b+=":";b+=c;b+="\r\n";});return b}function vd(a,b,c){a:{for(d in c){var d=!1;break a}d=!0;}d||(c=ud(c),"string"===typeof a?(null!=c&&encodeURIComponent(String(c))):S(a,b,c));}function wd(a,b,c){return c&&c.internalChannelParams?c.internalChannelParams[a]||b:b}
    function xd(a){this.Ca=0;this.i=[];this.j=new Gb;this.ka=this.sa=this.F=this.V=this.g=this.za=this.D=this.ia=this.o=this.S=this.s=null;this.$a=this.U=0;this.Ya=wd("failFast",!1,a);this.L=this.v=this.u=this.m=this.l=null;this.Y=!0;this.pa=this.Ba=this.T=-1;this.Z=this.A=this.C=0;this.Wa=wd("baseRetryDelayMs",5E3,a);this.ab=wd("retryDelaySeedMs",1E4,a);this.Za=wd("forwardChannelMaxRetries",2,a);this.ta=wd("forwardChannelRequestTimeoutMs",2E4,a);this.ra=a&&a.xmlHttpFactory||void 0;this.Da=a&&a.Yb||!1;
    this.J=void 0;this.H=a&&a.supportsCrossDomainXhr||!1;this.I="";this.h=new Wc$1(a&&a.concurrentRequestLimit);this.Fa=new ad;this.O=a&&a.fastHandshake||!1;this.N=a&&a.encodeInitMessageHeaders||!1;this.O&&this.N&&(this.N=!1);this.Xa=a&&a.Wb||!1;a&&a.Aa&&this.j.Aa();a&&a.forceLongPolling&&(this.Y=!1);this.$=!this.O&&this.Y&&a&&a.detectBufferingProxy||!1;this.ja=void 0;this.P=0;this.K=!1;this.la=this.B=null;}k$1=xd.prototype;k$1.ma=8;k$1.G=1;
    function Ac(a){yd(a);if(3==a.G){var b=a.U++,c=M$1(a.F);S(c,"SID",a.I);S(c,"RID",b);S(c,"TYPE","terminate");zd(a,c);b=new L$1(a,a.j,b,void 0);b.K=2;b.v=dc$1(M$1(c));c=!1;l.navigator&&l.navigator.sendBeacon&&(c=l.navigator.sendBeacon(b.v.toString(),""));!c&&l.Image&&((new Image).src=b.v,c=!0);c||(b.g=gc$1(b.l,null),b.g.da(b.v));b.F=Date.now();N$1(b);}Ad(a);}function sc$1(a){a.g&&(oc$1(a),a.g.cancel(),a.g=null);}
    function yd(a){sc$1(a);a.u&&(l.clearTimeout(a.u),a.u=null);rc$1(a);a.h.cancel();a.m&&("number"===typeof a.m&&l.clearTimeout(a.m),a.m=null);}function zc$1(a){Yc(a.h)||a.m||(a.m=!0,sb(a.Ja,a),a.C=0);}function Bd(a,b){if(uc$1(a.h)>=a.h.j-(a.m?1:0))return !1;if(a.m)return a.i=b.D.concat(a.i),!0;if(1==a.G||2==a.G||a.C>=(a.Ya?0:a.Za))return !1;a.m=J$1(q$1(a.Ja,a,b),Cd(a,a.C));a.C++;return !0}
    k$1.Ja=function(a){if(this.m)if(this.m=null,1==this.G){if(!a){this.U=Math.floor(1E5*Math.random());a=this.U++;const e=new L$1(this,this.j,a,void 0);let f=this.s;this.S&&(f?(f=Ra$1(f),Ta$1(f,this.S)):f=this.S);null!==this.o||this.N||(e.H=f,f=null);if(this.O)a:{var b=0;for(var c=0;c<this.i.length;c++){b:{var d=this.i[c];if("__data__"in d.g&&(d=d.g.__data__,"string"===typeof d)){d=d.length;break b}d=void 0;}if(void 0===d)break;b+=d;if(4096<b){b=c;break a}if(4096===b||c===this.i.length-1){b=c+1;break a}}b=1E3;}else b=
    1E3;b=Dd(this,e,b);c=M$1(this.F);S(c,"RID",a);S(c,"CVER",22);this.D&&S(c,"X-HTTP-Session-Id",this.D);zd(this,c);f&&(this.N?b="headers="+encodeURIComponent(String(ud(f)))+"&"+b:this.o&&vd(c,this.o,f));vc(this.h,e);this.Xa&&S(c,"TYPE","init");this.O?(S(c,"$req",b),S(c,"SID","null"),e.Z=!0,cc$1(e,c,null)):cc$1(e,c,b);this.G=2;}}else 3==this.G&&(a?Ed(this,a):0==this.i.length||Yc(this.h)||Ed(this));};
    function Ed(a,b){var c;b?c=b.m:c=a.U++;const d=M$1(a.F);S(d,"SID",a.I);S(d,"RID",c);S(d,"AID",a.T);zd(a,d);a.o&&a.s&&vd(d,a.o,a.s);c=new L$1(a,a.j,c,a.C+1);null===a.o&&(c.H=a.s);b&&(a.i=b.D.concat(a.i));b=Dd(a,c,1E3);c.setTimeout(Math.round(.5*a.ta)+Math.round(.5*a.ta*Math.random()));vc(a.h,c);cc$1(c,d,b);}function zd(a,b){a.ia&&Qa(a.ia,function(c,d){S(b,d,c);});a.l&&Dc({},function(c,d){S(b,d,c);});}
    function Dd(a,b,c){c=Math.min(a.i.length,c);var d=a.l?q$1(a.l.Qa,a.l,a):null;a:{var e=a.i;let f=-1;for(;;){const h=["count="+c];-1==f?0<c?(f=e[0].h,h.push("ofs="+f)):f=0:h.push("ofs="+f);let n=!0;for(let u=0;u<c;u++){let m=e[u].h;const r=e[u].g;m-=f;if(0>m)f=Math.max(0,e[u].h-100),n=!1;else try{bd(r,h,"req"+m+"_");}catch(F){d&&d(r);}}if(n){d=h.join("&");break a}}}a=a.i.splice(0,c);b.D=a;return d}function yc$1(a){a.g||a.u||(a.Z=1,sb(a.Ia,a),a.A=0);}
    function tc$1(a){if(a.g||a.u||3<=a.A)return !1;a.Z++;a.u=J$1(q$1(a.Ia,a),Cd(a,a.A));a.A++;return !0}k$1.Ia=function(){this.u=null;Fd(this);if(this.$&&!(this.K||null==this.g||0>=this.P)){var a=2*this.P;this.j.info("BP detection timer enabled: "+a);this.B=J$1(q$1(this.cb,this),a);}};k$1.cb=function(){this.B&&(this.B=null,this.j.info("BP detection timeout reached."),this.j.info("Buffering proxy detected and switch to long-polling!"),this.L=!1,this.K=!0,I(10),sc$1(this),Fd(this));};
    function oc$1(a){null!=a.B&&(l.clearTimeout(a.B),a.B=null);}function Fd(a){a.g=new L$1(a,a.j,"rpc",a.Z);null===a.o&&(a.g.H=a.s);a.g.N=0;var b=M$1(a.sa);S(b,"RID","rpc");S(b,"SID",a.I);S(b,"CI",a.L?"0":"1");S(b,"AID",a.T);S(b,"TYPE","xmlhttp");zd(a,b);a.o&&a.s&&vd(b,a.o,a.s);a.J&&a.g.setTimeout(a.J);var c=a.g;a=a.ka;c.K=1;c.v=dc$1(M$1(b));c.s=null;c.P=!0;ec$1(c,a);}k$1.bb=function(){null!=this.v&&(this.v=null,sc$1(this),tc$1(this),I(19));};function rc$1(a){null!=a.v&&(l.clearTimeout(a.v),a.v=null);}
    function mc$1(a,b){var c=null;if(a.g==b){rc$1(a);oc$1(a);a.g=null;var d=2;}else if(qc(a.h,b))c=b.D,xc$1(a.h,b),d=1;else return;if(0!=a.G)if(a.pa=b.Y,b.i)if(1==d){c=b.s?b.s.length:0;b=Date.now()-b.F;var e=a.C;d=Mb();C$1(d,new Pb(d,c));zc$1(a);}else yc$1(a);else if(e=b.o,3==e||0==e&&0<a.pa||!(1==d&&Bd(a,b)||2==d&&tc$1(a)))switch(c&&0<c.length&&(b=a.h,b.i=b.i.concat(c)),e){case 1:R$1(a,5);break;case 4:R$1(a,10);break;case 3:R$1(a,6);break;default:R$1(a,2);}}
    function Cd(a,b){let c=a.Wa+Math.floor(Math.random()*a.ab);a.l||(c*=2);return c*b}function R$1(a,b){a.j.info("Error code "+b);if(2==b){var c=null;a.l&&(c=null);var d=q$1(a.jb,a);c||(c=new T("//www.google.com/images/cleardot.gif"),l.location&&"http"==l.location.protocol||Gc$1(c,"https"),dc$1(c));cd(c.toString(),d);}else I(2);a.G=0;a.l&&a.l.va(b);Ad(a);yd(a);}k$1.jb=function(a){a?(this.j.info("Successfully pinged google.com"),I(2)):(this.j.info("Failed to ping google.com"),I(1));};
    function Ad(a){a.G=0;a.la=[];if(a.l){const b=Zc$1(a.h);if(0!=b.length||0!=a.i.length)na(a.la,b),na(a.la,a.i),a.h.i.length=0,ma$1(a.i),a.i.length=0;a.l.ua();}}function wc$1(a,b,c){var d=c instanceof T?M$1(c):new T(c,void 0);if(""!=d.g)b&&(d.g=b+"."+d.g),Hc(d,d.m);else {var e=l.location;d=e.protocol;b=b?b+"."+e.hostname:e.hostname;e=+e.port;var f=new T(null,void 0);d&&Gc$1(f,d);b&&(f.g=b);e&&Hc(f,e);c&&(f.l=c);d=f;}c=a.D;b=a.za;c&&b&&S(d,c,b);S(d,"VER",a.ma);zd(a,d);return d}
    function gc$1(a,b,c){if(b&&!a.H)throw Error("Can't create secondary domain capable XhrIo object.");b=c&&a.Da&&!a.ra?new W$1(new ed({ib:!0})):new W$1(a.ra);b.L=a.H;return b}function Gd(){}k$1=Gd.prototype;k$1.xa=function(){};k$1.wa=function(){};k$1.va=function(){};k$1.ua=function(){};k$1.Qa=function(){};function Hd(){if(y&&!(10<=Number(La)))throw Error("Environmental error: no available transport.");}Hd.prototype.g=function(a,b){return new X$1(a,b)};
    function X$1(a,b){B$1.call(this);this.g=new xd(b);this.l=a;this.h=b&&b.messageUrlParams||null;a=b&&b.messageHeaders||null;b&&b.clientProtocolHeaderRequired&&(a?a["X-Client-Protocol"]="webchannel":a={"X-Client-Protocol":"webchannel"});this.g.s=a;a=b&&b.initMessageHeaders||null;b&&b.messageContentType&&(a?a["X-WebChannel-Content-Type"]=b.messageContentType:a={"X-WebChannel-Content-Type":b.messageContentType});b&&b.ya&&(a?a["X-WebChannel-Client-Profile"]=b.ya:a={"X-WebChannel-Client-Profile":b.ya});this.g.S=
    a;(a=b&&b.Xb)&&!pa$1(a)&&(this.g.o=a);this.A=b&&b.supportsCrossDomainXhr||!1;this.v=b&&b.sendRawJson||!1;(b=b&&b.httpSessionIdParam)&&!pa$1(b)&&(this.g.D=b,a=this.h,null!==a&&b in a&&(a=this.h,b in a&&delete a[b]));this.j=new Y$1(this);}t(X$1,B$1);X$1.prototype.m=function(){this.g.l=this.j;this.A&&(this.g.H=!0);var a=this.g,b=this.l,c=this.h||void 0;I(0);a.V=b;a.ia=c||{};a.L=a.Y;a.F=wc$1(a,null,a.V);zc$1(a);};X$1.prototype.close=function(){Ac(this.g);};
    X$1.prototype.u=function(a){var b=this.g;if("string"===typeof a){var c={};c.__data__=a;a=c;}else this.v&&(c={},c.__data__=lb(a),a=c);b.i.push(new Vc(b.$a++,a));3==b.G&&zc$1(b);};X$1.prototype.M=function(){this.g.l=null;delete this.j;Ac(this.g);delete this.g;X$1.X.M.call(this);};function Id(a){Vb.call(this);var b=a.__sm__;if(b){a:{for(const c in b){a=c;break a}a=void 0;}if(this.i=a)a=this.i,b=null!==b&&a in b?b[a]:void 0;this.data=b;}else this.data=a;}t(Id,Vb);function Jd(){Wb.call(this);this.status=1;}t(Jd,Wb);
    function Y$1(a){this.g=a;}t(Y$1,Gd);Y$1.prototype.xa=function(){C$1(this.g,"a");};Y$1.prototype.wa=function(a){C$1(this.g,new Id(a));};Y$1.prototype.va=function(a){C$1(this.g,new Jd());};Y$1.prototype.ua=function(){C$1(this.g,"b");};/*

     Copyright 2017 Google LLC

     Licensed under the Apache License, Version 2.0 (the "License");
     you may not use this file except in compliance with the License.
     You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

     Unless required by applicable law or agreed to in writing, software
     distributed under the License is distributed on an "AS IS" BASIS,
     WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     See the License for the specific language governing permissions and
     limitations under the License.
    */
    Hd.prototype.createWebChannel=Hd.prototype.g;X$1.prototype.send=X$1.prototype.u;X$1.prototype.open=X$1.prototype.m;X$1.prototype.close=X$1.prototype.close;Qb.NO_ERROR=0;Qb.TIMEOUT=8;Qb.HTTP_ERROR=6;Rb.COMPLETE="complete";Ub.EventType=K;K.OPEN="a";K.CLOSE="b";K.ERROR="c";K.MESSAGE="d";B$1.prototype.listen=B$1.prototype.N;W$1.prototype.listenOnce=W$1.prototype.O;W$1.prototype.getLastError=W$1.prototype.Na;W$1.prototype.getLastErrorCode=W$1.prototype.Ea;W$1.prototype.getStatus=W$1.prototype.aa;W$1.prototype.getResponseJson=W$1.prototype.Ra;
    W$1.prototype.getResponseText=W$1.prototype.fa;W$1.prototype.send=W$1.prototype.da;var createWebChannelTransport = function(){return new Hd};var getStatEventTarget = function(){return Mb()};var ErrorCode = Qb;var EventType = Rb;var Event = G$1;var Stat = {rb:0,ub:1,vb:2,Ob:3,Tb:4,Qb:5,Rb:6,Pb:7,Nb:8,Sb:9,PROXY:10,NOPROXY:11,Lb:12,Hb:13,Ib:14,Gb:15,Jb:16,Kb:17,nb:18,mb:19,ob:20};var FetchXmlHttpFactory = ed;var WebChannel = Ub;
    var XhrIo = W$1;

    const R = "@firebase/firestore";

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Simple wrapper around a nullable UID. Mostly exists to make code more
     * readable.
     */
    class b {
        constructor(t) {
            this.uid = t;
        }
        isAuthenticated() {
            return null != this.uid;
        }
        /**
         * Returns a key representing this user, suitable for inclusion in a
         * dictionary.
         */    toKey() {
            return this.isAuthenticated() ? "uid:" + this.uid : "anonymous-user";
        }
        isEqual(t) {
            return t.uid === this.uid;
        }
    }

    /** A user with a null UID. */ b.UNAUTHENTICATED = new b(null), 
    // TODO(mikelehen): Look into getting a proper uid-equivalent for
    // non-FirebaseAuth providers.
    b.GOOGLE_CREDENTIALS = new b("google-credentials-uid"), b.FIRST_PARTY = new b("first-party-uid"), 
    b.MOCK_USER = new b("mock-user");

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    let P = "9.10.0";

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    const v = new Logger("@firebase/firestore");

    // Helper methods are needed because variables can't be exported as read/write
    function V() {
        return v.logLevel;
    }

    function D(t, ...e) {
        if (v.logLevel <= LogLevel.DEBUG) {
            const n = e.map(N);
            v.debug(`Firestore (${P}): ${t}`, ...n);
        }
    }

    function C(t, ...e) {
        if (v.logLevel <= LogLevel.ERROR) {
            const n = e.map(N);
            v.error(`Firestore (${P}): ${t}`, ...n);
        }
    }

    /**
     * @internal
     */ function x(t, ...e) {
        if (v.logLevel <= LogLevel.WARN) {
            const n = e.map(N);
            v.warn(`Firestore (${P}): ${t}`, ...n);
        }
    }

    /**
     * Converts an additional log parameter to a string representation.
     */ function N(t) {
        if ("string" == typeof t) return t;
        try {
            return e = t, JSON.stringify(e);
        } catch (e) {
            // Converting to JSON failed, just log the object directly
            return t;
        }
        /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
        /** Formats an object as a JSON string, suitable for logging. */
        var e;
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Unconditionally fails, throwing an Error with the given message.
     * Messages are stripped in production builds.
     *
     * Returns `never` and can be used in expressions:
     * @example
     * let futureVar = fail('not implemented yet');
     */ function k(t = "Unexpected state") {
        // Log the failure in addition to throw an exception, just in case the
        // exception is swallowed.
        const e = `FIRESTORE (${P}) INTERNAL ASSERTION FAILED: ` + t;
        // NOTE: We don't use FirestoreError here because these are internal failures
        // that cannot be handled by the user. (Also it would create a circular
        // dependency between the error and assert modules which doesn't work.)
        throw C(e), new Error(e);
    }

    /**
     * Fails if the given assertion condition is false, throwing an Error with the
     * given message if it did.
     *
     * Messages are stripped in production builds.
     */ function M(t, e) {
        t || k();
    }

    /**
     * Casts `obj` to `T`. In non-production builds, verifies that `obj` is an
     * instance of `T` before casting.
     */ function F(t, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    e) {
        return t;
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */ const $ = {
        // Causes are copied from:
        // https://github.com/grpc/grpc/blob/bceec94ea4fc5f0085d81235d8e1c06798dc341a/include/grpc%2B%2B/impl/codegen/status_code_enum.h
        /** Not an error; returned on success. */
        OK: "ok",
        /** The operation was cancelled (typically by the caller). */
        CANCELLED: "cancelled",
        /** Unknown error or an error from a different error domain. */
        UNKNOWN: "unknown",
        /**
         * Client specified an invalid argument. Note that this differs from
         * FAILED_PRECONDITION. INVALID_ARGUMENT indicates arguments that are
         * problematic regardless of the state of the system (e.g., a malformed file
         * name).
         */
        INVALID_ARGUMENT: "invalid-argument",
        /**
         * Deadline expired before operation could complete. For operations that
         * change the state of the system, this error may be returned even if the
         * operation has completed successfully. For example, a successful response
         * from a server could have been delayed long enough for the deadline to
         * expire.
         */
        DEADLINE_EXCEEDED: "deadline-exceeded",
        /** Some requested entity (e.g., file or directory) was not found. */
        NOT_FOUND: "not-found",
        /**
         * Some entity that we attempted to create (e.g., file or directory) already
         * exists.
         */
        ALREADY_EXISTS: "already-exists",
        /**
         * The caller does not have permission to execute the specified operation.
         * PERMISSION_DENIED must not be used for rejections caused by exhausting
         * some resource (use RESOURCE_EXHAUSTED instead for those errors).
         * PERMISSION_DENIED must not be used if the caller can not be identified
         * (use UNAUTHENTICATED instead for those errors).
         */
        PERMISSION_DENIED: "permission-denied",
        /**
         * The request does not have valid authentication credentials for the
         * operation.
         */
        UNAUTHENTICATED: "unauthenticated",
        /**
         * Some resource has been exhausted, perhaps a per-user quota, or perhaps the
         * entire file system is out of space.
         */
        RESOURCE_EXHAUSTED: "resource-exhausted",
        /**
         * Operation was rejected because the system is not in a state required for
         * the operation's execution. For example, directory to be deleted may be
         * non-empty, an rmdir operation is applied to a non-directory, etc.
         *
         * A litmus test that may help a service implementor in deciding
         * between FAILED_PRECONDITION, ABORTED, and UNAVAILABLE:
         *  (a) Use UNAVAILABLE if the client can retry just the failing call.
         *  (b) Use ABORTED if the client should retry at a higher-level
         *      (e.g., restarting a read-modify-write sequence).
         *  (c) Use FAILED_PRECONDITION if the client should not retry until
         *      the system state has been explicitly fixed. E.g., if an "rmdir"
         *      fails because the directory is non-empty, FAILED_PRECONDITION
         *      should be returned since the client should not retry unless
         *      they have first fixed up the directory by deleting files from it.
         *  (d) Use FAILED_PRECONDITION if the client performs conditional
         *      REST Get/Update/Delete on a resource and the resource on the
         *      server does not match the condition. E.g., conflicting
         *      read-modify-write on the same resource.
         */
        FAILED_PRECONDITION: "failed-precondition",
        /**
         * The operation was aborted, typically due to a concurrency issue like
         * sequencer check failures, transaction aborts, etc.
         *
         * See litmus test above for deciding between FAILED_PRECONDITION, ABORTED,
         * and UNAVAILABLE.
         */
        ABORTED: "aborted",
        /**
         * Operation was attempted past the valid range. E.g., seeking or reading
         * past end of file.
         *
         * Unlike INVALID_ARGUMENT, this error indicates a problem that may be fixed
         * if the system state changes. For example, a 32-bit file system will
         * generate INVALID_ARGUMENT if asked to read at an offset that is not in the
         * range [0,2^32-1], but it will generate OUT_OF_RANGE if asked to read from
         * an offset past the current file size.
         *
         * There is a fair bit of overlap between FAILED_PRECONDITION and
         * OUT_OF_RANGE. We recommend using OUT_OF_RANGE (the more specific error)
         * when it applies so that callers who are iterating through a space can
         * easily look for an OUT_OF_RANGE error to detect when they are done.
         */
        OUT_OF_RANGE: "out-of-range",
        /** Operation is not implemented or not supported/enabled in this service. */
        UNIMPLEMENTED: "unimplemented",
        /**
         * Internal errors. Means some invariants expected by underlying System has
         * been broken. If you see one of these errors, Something is very broken.
         */
        INTERNAL: "internal",
        /**
         * The service is currently unavailable. This is a most likely a transient
         * condition and may be corrected by retrying with a backoff.
         *
         * See litmus test above for deciding between FAILED_PRECONDITION, ABORTED,
         * and UNAVAILABLE.
         */
        UNAVAILABLE: "unavailable",
        /** Unrecoverable data loss or corruption. */
        DATA_LOSS: "data-loss"
    };

    /** An error returned by a Firestore operation. */ class B extends FirebaseError {
        /** @hideconstructor */
        constructor(
        /**
         * The backend error code associated with this error.
         */
        t, 
        /**
         * A custom error description.
         */
        e) {
            super(t, e), this.code = t, this.message = e, 
            // HACK: We write a toString property directly because Error is not a real
            // class and so inheritance does not work correctly. We could alternatively
            // do the same "back-door inheritance" trick that FirebaseError does.
            this.toString = () => `${this.name}: [code=${this.code}]: ${this.message}`;
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */ class L {
        constructor() {
            this.promise = new Promise(((t, e) => {
                this.resolve = t, this.reject = e;
            }));
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */ class U {
        constructor(t, e) {
            this.user = e, this.type = "OAuth", this.headers = new Map, this.headers.set("Authorization", `Bearer ${t}`);
        }
    }

    /**
     * A CredentialsProvider that always yields an empty token.
     * @internal
     */ class q {
        getToken() {
            return Promise.resolve(null);
        }
        invalidateToken() {}
        start(t, e) {
            // Fire with initial user.
            t.enqueueRetryable((() => e(b.UNAUTHENTICATED)));
        }
        shutdown() {}
    }

    class G {
        constructor(t) {
            this.t = t, 
            /** Tracks the current User. */
            this.currentUser = b.UNAUTHENTICATED, 
            /**
             * Counter used to detect if the token changed while a getToken request was
             * outstanding.
             */
            this.i = 0, this.forceRefresh = !1, this.auth = null;
        }
        start(t, e) {
            let n = this.i;
            // A change listener that prevents double-firing for the same token change.
                    const s = t => this.i !== n ? (n = this.i, e(t)) : Promise.resolve();
            // A promise that can be waited on to block on the next token change.
            // This promise is re-created after each change.
                    let i = new L;
            this.o = () => {
                this.i++, this.currentUser = this.u(), i.resolve(), i = new L, t.enqueueRetryable((() => s(this.currentUser)));
            };
            const r = () => {
                const e = i;
                t.enqueueRetryable((async () => {
                    await e.promise, await s(this.currentUser);
                }));
            }, o = t => {
                D("FirebaseAuthCredentialsProvider", "Auth detected"), this.auth = t, this.auth.addAuthTokenListener(this.o), 
                r();
            };
            this.t.onInit((t => o(t))), 
            // Our users can initialize Auth right after Firestore, so we give it
            // a chance to register itself with the component framework before we
            // determine whether to start up in unauthenticated mode.
            setTimeout((() => {
                if (!this.auth) {
                    const t = this.t.getImmediate({
                        optional: !0
                    });
                    t ? o(t) : (
                    // If auth is still not available, proceed with `null` user
                    D("FirebaseAuthCredentialsProvider", "Auth not yet detected"), i.resolve(), i = new L);
                }
            }), 0), r();
        }
        getToken() {
            // Take note of the current value of the tokenCounter so that this method
            // can fail (with an ABORTED error) if there is a token change while the
            // request is outstanding.
            const t = this.i, e = this.forceRefresh;
            return this.forceRefresh = !1, this.auth ? this.auth.getToken(e).then((e => 
            // Cancel the request since the token changed while the request was
            // outstanding so the response is potentially for a previous user (which
            // user, we can't be sure).
            this.i !== t ? (D("FirebaseAuthCredentialsProvider", "getToken aborted due to token change."), 
            this.getToken()) : e ? (M("string" == typeof e.accessToken), new U(e.accessToken, this.currentUser)) : null)) : Promise.resolve(null);
        }
        invalidateToken() {
            this.forceRefresh = !0;
        }
        shutdown() {
            this.auth && this.auth.removeAuthTokenListener(this.o);
        }
        // Auth.getUid() can return null even with a user logged in. It is because
        // getUid() is synchronous, but the auth code populating Uid is asynchronous.
        // This method should only be called in the AuthTokenListener callback
        // to guarantee to get the actual user.
        u() {
            const t = this.auth && this.auth.getUid();
            return M(null === t || "string" == typeof t), new b(t);
        }
    }

    /*
     * FirstPartyToken provides a fresh token each time its value
     * is requested, because if the token is too old, requests will be rejected.
     * Technically this may no longer be necessary since the SDK should gracefully
     * recover from unauthenticated errors (see b/33147818 for context), but it's
     * safer to keep the implementation as-is.
     */ class Q {
        constructor(t, e, n, s) {
            this.h = t, this.l = e, this.m = n, this.g = s, this.type = "FirstParty", this.user = b.FIRST_PARTY, 
            this.p = new Map;
        }
        /** Gets an authorization token, using a provided factory function, or falling back to First Party GAPI. */    I() {
            return this.g ? this.g() : (
            // Make sure this really is a Gapi client.
            M(!("object" != typeof this.h || null === this.h || !this.h.auth || !this.h.auth.getAuthHeaderValueForFirstParty)), 
            this.h.auth.getAuthHeaderValueForFirstParty([]));
        }
        get headers() {
            this.p.set("X-Goog-AuthUser", this.l);
            // Use array notation to prevent minification
            const t = this.I();
            return t && this.p.set("Authorization", t), this.m && this.p.set("X-Goog-Iam-Authorization-Token", this.m), 
            this.p;
        }
    }

    /*
     * Provides user credentials required for the Firestore JavaScript SDK
     * to authenticate the user, using technique that is only available
     * to applications hosted by Google.
     */ class j {
        constructor(t, e, n, s) {
            this.h = t, this.l = e, this.m = n, this.g = s;
        }
        getToken() {
            return Promise.resolve(new Q(this.h, this.l, this.m, this.g));
        }
        start(t, e) {
            // Fire with initial uid.
            t.enqueueRetryable((() => e(b.FIRST_PARTY)));
        }
        shutdown() {}
        invalidateToken() {}
    }

    class W {
        constructor(t) {
            this.value = t, this.type = "AppCheck", this.headers = new Map, t && t.length > 0 && this.headers.set("x-firebase-appcheck", this.value);
        }
    }

    class z {
        constructor(t) {
            this.T = t, this.forceRefresh = !1, this.appCheck = null, this.A = null;
        }
        start(t, e) {
            const n = t => {
                null != t.error && D("FirebaseAppCheckTokenProvider", `Error getting App Check token; using placeholder token instead. Error: ${t.error.message}`);
                const n = t.token !== this.A;
                return this.A = t.token, D("FirebaseAppCheckTokenProvider", `Received ${n ? "new" : "existing"} token.`), 
                n ? e(t.token) : Promise.resolve();
            };
            this.o = e => {
                t.enqueueRetryable((() => n(e)));
            };
            const s = t => {
                D("FirebaseAppCheckTokenProvider", "AppCheck detected"), this.appCheck = t, this.appCheck.addTokenListener(this.o);
            };
            this.T.onInit((t => s(t))), 
            // Our users can initialize AppCheck after Firestore, so we give it
            // a chance to register itself with the component framework.
            setTimeout((() => {
                if (!this.appCheck) {
                    const t = this.T.getImmediate({
                        optional: !0
                    });
                    t ? s(t) : 
                    // If AppCheck is still not available, proceed without it.
                    D("FirebaseAppCheckTokenProvider", "AppCheck not yet detected");
                }
            }), 0);
        }
        getToken() {
            const t = this.forceRefresh;
            return this.forceRefresh = !1, this.appCheck ? this.appCheck.getToken(t).then((t => t ? (M("string" == typeof t.token), 
            this.A = t.token, new W(t.token)) : null)) : Promise.resolve(null);
        }
        invalidateToken() {
            this.forceRefresh = !0;
        }
        shutdown() {
            this.appCheck && this.appCheck.removeTokenListener(this.o);
        }
    }

    /**
     * Builds a CredentialsProvider depending on the type of
     * the credentials passed in.
     */
    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Generates `nBytes` of random bytes.
     *
     * If `nBytes < 0` , an error will be thrown.
     */
    function J(t) {
        // Polyfills for IE and WebWorker by using `self` and `msCrypto` when `crypto` is not available.
        const e = 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "undefined" != typeof self && (self.crypto || self.msCrypto), n = new Uint8Array(t);
        if (e && "function" == typeof e.getRandomValues) e.getRandomValues(n); else 
        // Falls back to Math.random
        for (let e = 0; e < t; e++) n[e] = Math.floor(256 * Math.random());
        return n;
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */ class Y {
        static R() {
            // Alphanumeric characters
            const t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", e = Math.floor(256 / t.length) * t.length;
            // The largest byte value that is a multiple of `char.length`.
                    let n = "";
            for (;n.length < 20; ) {
                const s = J(40);
                for (let i = 0; i < s.length; ++i) 
                // Only accept values that are [0, maxMultiple), this ensures they can
                // be evenly mapped to indices of `chars` via a modulo operation.
                n.length < 20 && s[i] < e && (n += t.charAt(s[i] % t.length));
            }
            return n;
        }
    }

    function X(t, e) {
        return t < e ? -1 : t > e ? 1 : 0;
    }

    /** Helper to compare arrays using isEqual(). */ function Z(t, e, n) {
        return t.length === e.length && t.every(((t, s) => n(t, e[s])));
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    // The earliest date supported by Firestore timestamps (0001-01-01T00:00:00Z).
    /**
     * A `Timestamp` represents a point in time independent of any time zone or
     * calendar, represented as seconds and fractions of seconds at nanosecond
     * resolution in UTC Epoch time.
     *
     * It is encoded using the Proleptic Gregorian Calendar which extends the
     * Gregorian calendar backwards to year one. It is encoded assuming all minutes
     * are 60 seconds long, i.e. leap seconds are "smeared" so that no leap second
     * table is needed for interpretation. Range is from 0001-01-01T00:00:00Z to
     * 9999-12-31T23:59:59.999999999Z.
     *
     * For examples and further specifications, refer to the
     * {@link https://github.com/google/protobuf/blob/master/src/google/protobuf/timestamp.proto | Timestamp definition}.
     */
    class et {
        /**
         * Creates a new timestamp.
         *
         * @param seconds - The number of seconds of UTC time since Unix epoch
         *     1970-01-01T00:00:00Z. Must be from 0001-01-01T00:00:00Z to
         *     9999-12-31T23:59:59Z inclusive.
         * @param nanoseconds - The non-negative fractions of a second at nanosecond
         *     resolution. Negative second values with fractions must still have
         *     non-negative nanoseconds values that count forward in time. Must be
         *     from 0 to 999,999,999 inclusive.
         */
        constructor(
        /**
         * The number of seconds of UTC time since Unix epoch 1970-01-01T00:00:00Z.
         */
        t, 
        /**
         * The fractions of a second at nanosecond resolution.*
         */
        e) {
            if (this.seconds = t, this.nanoseconds = e, e < 0) throw new B($.INVALID_ARGUMENT, "Timestamp nanoseconds out of range: " + e);
            if (e >= 1e9) throw new B($.INVALID_ARGUMENT, "Timestamp nanoseconds out of range: " + e);
            if (t < -62135596800) throw new B($.INVALID_ARGUMENT, "Timestamp seconds out of range: " + t);
            // This will break in the year 10,000.
                    if (t >= 253402300800) throw new B($.INVALID_ARGUMENT, "Timestamp seconds out of range: " + t);
        }
        /**
         * Creates a new timestamp with the current date, with millisecond precision.
         *
         * @returns a new timestamp representing the current date.
         */    static now() {
            return et.fromMillis(Date.now());
        }
        /**
         * Creates a new timestamp from the given date.
         *
         * @param date - The date to initialize the `Timestamp` from.
         * @returns A new `Timestamp` representing the same point in time as the given
         *     date.
         */    static fromDate(t) {
            return et.fromMillis(t.getTime());
        }
        /**
         * Creates a new timestamp from the given number of milliseconds.
         *
         * @param milliseconds - Number of milliseconds since Unix epoch
         *     1970-01-01T00:00:00Z.
         * @returns A new `Timestamp` representing the same point in time as the given
         *     number of milliseconds.
         */    static fromMillis(t) {
            const e = Math.floor(t / 1e3), n = Math.floor(1e6 * (t - 1e3 * e));
            return new et(e, n);
        }
        /**
         * Converts a `Timestamp` to a JavaScript `Date` object. This conversion
         * causes a loss of precision since `Date` objects only support millisecond
         * precision.
         *
         * @returns JavaScript `Date` object representing the same point in time as
         *     this `Timestamp`, with millisecond precision.
         */    toDate() {
            return new Date(this.toMillis());
        }
        /**
         * Converts a `Timestamp` to a numeric timestamp (in milliseconds since
         * epoch). This operation causes a loss of precision.
         *
         * @returns The point in time corresponding to this timestamp, represented as
         *     the number of milliseconds since Unix epoch 1970-01-01T00:00:00Z.
         */    toMillis() {
            return 1e3 * this.seconds + this.nanoseconds / 1e6;
        }
        _compareTo(t) {
            return this.seconds === t.seconds ? X(this.nanoseconds, t.nanoseconds) : X(this.seconds, t.seconds);
        }
        /**
         * Returns true if this `Timestamp` is equal to the provided one.
         *
         * @param other - The `Timestamp` to compare against.
         * @returns true if this `Timestamp` is equal to the provided one.
         */    isEqual(t) {
            return t.seconds === this.seconds && t.nanoseconds === this.nanoseconds;
        }
        /** Returns a textual representation of this `Timestamp`. */    toString() {
            return "Timestamp(seconds=" + this.seconds + ", nanoseconds=" + this.nanoseconds + ")";
        }
        /** Returns a JSON-serializable representation of this `Timestamp`. */    toJSON() {
            return {
                seconds: this.seconds,
                nanoseconds: this.nanoseconds
            };
        }
        /**
         * Converts this object to a primitive string, which allows `Timestamp` objects
         * to be compared using the `>`, `<=`, `>=` and `>` operators.
         */    valueOf() {
            // This method returns a string of the form <seconds>.<nanoseconds> where
            // <seconds> is translated to have a non-negative value and both <seconds>
            // and <nanoseconds> are left-padded with zeroes to be a consistent length.
            // Strings with this format then have a lexiographical ordering that matches
            // the expected ordering. The <seconds> translation is done to avoid having
            // a leading negative sign (i.e. a leading '-' character) in its string
            // representation, which would affect its lexiographical ordering.
            const t = this.seconds - -62135596800;
            // Note: Up to 12 decimal digits are required to represent all valid
            // 'seconds' values.
                    return String(t).padStart(12, "0") + "." + String(this.nanoseconds).padStart(9, "0");
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * A version of a document in Firestore. This corresponds to the version
     * timestamp, such as update_time or read_time.
     */ class nt {
        constructor(t) {
            this.timestamp = t;
        }
        static fromTimestamp(t) {
            return new nt(t);
        }
        static min() {
            return new nt(new et(0, 0));
        }
        static max() {
            return new nt(new et(253402300799, 999999999));
        }
        compareTo(t) {
            return this.timestamp._compareTo(t.timestamp);
        }
        isEqual(t) {
            return this.timestamp.isEqual(t.timestamp);
        }
        /** Returns a number representation of the version for use in spec tests. */    toMicroseconds() {
            // Convert to microseconds.
            return 1e6 * this.timestamp.seconds + this.timestamp.nanoseconds / 1e3;
        }
        toString() {
            return "SnapshotVersion(" + this.timestamp.toString() + ")";
        }
        toTimestamp() {
            return this.timestamp;
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Path represents an ordered sequence of string segments.
     */
    class st {
        constructor(t, e, n) {
            void 0 === e ? e = 0 : e > t.length && k(), void 0 === n ? n = t.length - e : n > t.length - e && k(), 
            this.segments = t, this.offset = e, this.len = n;
        }
        get length() {
            return this.len;
        }
        isEqual(t) {
            return 0 === st.comparator(this, t);
        }
        child(t) {
            const e = this.segments.slice(this.offset, this.limit());
            return t instanceof st ? t.forEach((t => {
                e.push(t);
            })) : e.push(t), this.construct(e);
        }
        /** The index of one past the last segment of the path. */    limit() {
            return this.offset + this.length;
        }
        popFirst(t) {
            return t = void 0 === t ? 1 : t, this.construct(this.segments, this.offset + t, this.length - t);
        }
        popLast() {
            return this.construct(this.segments, this.offset, this.length - 1);
        }
        firstSegment() {
            return this.segments[this.offset];
        }
        lastSegment() {
            return this.get(this.length - 1);
        }
        get(t) {
            return this.segments[this.offset + t];
        }
        isEmpty() {
            return 0 === this.length;
        }
        isPrefixOf(t) {
            if (t.length < this.length) return !1;
            for (let e = 0; e < this.length; e++) if (this.get(e) !== t.get(e)) return !1;
            return !0;
        }
        isImmediateParentOf(t) {
            if (this.length + 1 !== t.length) return !1;
            for (let e = 0; e < this.length; e++) if (this.get(e) !== t.get(e)) return !1;
            return !0;
        }
        forEach(t) {
            for (let e = this.offset, n = this.limit(); e < n; e++) t(this.segments[e]);
        }
        toArray() {
            return this.segments.slice(this.offset, this.limit());
        }
        static comparator(t, e) {
            const n = Math.min(t.length, e.length);
            for (let s = 0; s < n; s++) {
                const n = t.get(s), i = e.get(s);
                if (n < i) return -1;
                if (n > i) return 1;
            }
            return t.length < e.length ? -1 : t.length > e.length ? 1 : 0;
        }
    }

    /**
     * A slash-separated path for navigating resources (documents and collections)
     * within Firestore.
     *
     * @internal
     */ class it extends st {
        construct(t, e, n) {
            return new it(t, e, n);
        }
        canonicalString() {
            // NOTE: The client is ignorant of any path segments containing escape
            // sequences (e.g. __id123__) and just passes them through raw (they exist
            // for legacy reasons and should not be used frequently).
            return this.toArray().join("/");
        }
        toString() {
            return this.canonicalString();
        }
        /**
         * Creates a resource path from the given slash-delimited string. If multiple
         * arguments are provided, all components are combined. Leading and trailing
         * slashes from all components are ignored.
         */    static fromString(...t) {
            // NOTE: The client is ignorant of any path segments containing escape
            // sequences (e.g. __id123__) and just passes them through raw (they exist
            // for legacy reasons and should not be used frequently).
            const e = [];
            for (const n of t) {
                if (n.indexOf("//") >= 0) throw new B($.INVALID_ARGUMENT, `Invalid segment (${n}). Paths must not contain // in them.`);
                // Strip leading and traling slashed.
                            e.push(...n.split("/").filter((t => t.length > 0)));
            }
            return new it(e);
        }
        static emptyPath() {
            return new it([]);
        }
    }

    const rt = /^[_a-zA-Z][_a-zA-Z0-9]*$/;

    /**
     * A dot-separated path for navigating sub-objects within a document.
     * @internal
     */ class ot extends st {
        construct(t, e, n) {
            return new ot(t, e, n);
        }
        /**
         * Returns true if the string could be used as a segment in a field path
         * without escaping.
         */    static isValidIdentifier(t) {
            return rt.test(t);
        }
        canonicalString() {
            return this.toArray().map((t => (t = t.replace(/\\/g, "\\\\").replace(/`/g, "\\`"), 
            ot.isValidIdentifier(t) || (t = "`" + t + "`"), t))).join(".");
        }
        toString() {
            return this.canonicalString();
        }
        /**
         * Returns true if this field references the key of a document.
         */    isKeyField() {
            return 1 === this.length && "__name__" === this.get(0);
        }
        /**
         * The field designating the key of a document.
         */    static keyField() {
            return new ot([ "__name__" ]);
        }
        /**
         * Parses a field string from the given server-formatted string.
         *
         * - Splitting the empty string is not allowed (for now at least).
         * - Empty segments within the string (e.g. if there are two consecutive
         *   separators) are not allowed.
         *
         * TODO(b/37244157): we should make this more strict. Right now, it allows
         * non-identifier path components, even if they aren't escaped.
         */    static fromServerFormat(t) {
            const e = [];
            let n = "", s = 0;
            const i = () => {
                if (0 === n.length) throw new B($.INVALID_ARGUMENT, `Invalid field path (${t}). Paths must not be empty, begin with '.', end with '.', or contain '..'`);
                e.push(n), n = "";
            };
            let r = !1;
            for (;s < t.length; ) {
                const e = t[s];
                if ("\\" === e) {
                    if (s + 1 === t.length) throw new B($.INVALID_ARGUMENT, "Path has trailing escape character: " + t);
                    const e = t[s + 1];
                    if ("\\" !== e && "." !== e && "`" !== e) throw new B($.INVALID_ARGUMENT, "Path has invalid escape sequence: " + t);
                    n += e, s += 2;
                } else "`" === e ? (r = !r, s++) : "." !== e || r ? (n += e, s++) : (i(), s++);
            }
            if (i(), r) throw new B($.INVALID_ARGUMENT, "Unterminated ` in path: " + t);
            return new ot(e);
        }
        static emptyPath() {
            return new ot([]);
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * @internal
     */ class ut {
        constructor(t) {
            this.path = t;
        }
        static fromPath(t) {
            return new ut(it.fromString(t));
        }
        static fromName(t) {
            return new ut(it.fromString(t).popFirst(5));
        }
        static empty() {
            return new ut(it.emptyPath());
        }
        get collectionGroup() {
            return this.path.popLast().lastSegment();
        }
        /** Returns true if the document is in the specified collectionId. */    hasCollectionId(t) {
            return this.path.length >= 2 && this.path.get(this.path.length - 2) === t;
        }
        /** Returns the collection group (i.e. the name of the parent collection) for this key. */    getCollectionGroup() {
            return this.path.get(this.path.length - 2);
        }
        /** Returns the fully qualified path to the parent collection. */    getCollectionPath() {
            return this.path.popLast();
        }
        isEqual(t) {
            return null !== t && 0 === it.comparator(this.path, t.path);
        }
        toString() {
            return this.path.toString();
        }
        static comparator(t, e) {
            return it.comparator(t.path, e.path);
        }
        static isDocumentKey(t) {
            return t.length % 2 == 0;
        }
        /**
         * Creates and returns a new document key with the given segments.
         *
         * @param segments - The segments of the path to the document
         * @returns A new instance of DocumentKey
         */    static fromSegments(t) {
            return new ut(new it(t.slice()));
        }
    }

    /**
     * Creates an offset that matches all documents with a read time higher than
     * `readTime`.
     */ function wt(t, e) {
        // We want to create an offset that matches all documents with a read time
        // greater than the provided read time. To do so, we technically need to
        // create an offset for `(readTime, MAX_DOCUMENT_KEY)`. While we could use
        // Unicode codepoints to generate MAX_DOCUMENT_KEY, it is much easier to use
        // `(readTime + 1, DocumentKey.empty())` since `> DocumentKey.empty()` matches
        // all valid document IDs.
        const n = t.toTimestamp().seconds, s = t.toTimestamp().nanoseconds + 1, i = nt.fromTimestamp(1e9 === s ? new et(n + 1, 0) : new et(n, s));
        return new gt(i, ut.empty(), e);
    }

    /** Creates a new offset based on the provided document. */ function mt(t) {
        return new gt(t.readTime, t.key, -1);
    }

    /**
     * Stores the latest read time, document and batch ID that were processed for an
     * index.
     */ class gt {
        constructor(
        /**
         * The latest read time version that has been indexed by Firestore for this
         * field index.
         */
        t, 
        /**
         * The key of the last document that was indexed for this query. Use
         * `DocumentKey.empty()` if no document has been indexed.
         */
        e, 
        /*
         * The largest mutation batch id that's been processed by Firestore.
         */
        n) {
            this.readTime = t, this.documentKey = e, this.largestBatchId = n;
        }
        /** Returns an offset that sorts before all regular offsets. */    static min() {
            return new gt(nt.min(), ut.empty(), -1);
        }
        /** Returns an offset that sorts after all regular offsets. */    static max() {
            return new gt(nt.max(), ut.empty(), -1);
        }
    }

    function yt(t, e) {
        let n = t.readTime.compareTo(e.readTime);
        return 0 !== n ? n : (n = ut.comparator(t.documentKey, e.documentKey), 0 !== n ? n : X(t.largestBatchId, e.largestBatchId));
    }

    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */ const pt = "The current tab is not in the required state to perform this operation. It might be necessary to refresh the browser tab.";

    /**
     * A base class representing a persistence transaction, encapsulating both the
     * transaction's sequence numbers as well as a list of onCommitted listeners.
     *
     * When you call Persistence.runTransaction(), it will create a transaction and
     * pass it to your callback. You then pass it to any method that operates
     * on persistence.
     */ class It {
        constructor() {
            this.onCommittedListeners = [];
        }
        addOnCommittedListener(t) {
            this.onCommittedListeners.push(t);
        }
        raiseOnCommittedEvent() {
            this.onCommittedListeners.forEach((t => t()));
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Verifies the error thrown by a LocalStore operation. If a LocalStore
     * operation fails because the primary lease has been taken by another client,
     * we ignore the error (the persistence layer will immediately call
     * `applyPrimaryLease` to propagate the primary state change). All other errors
     * are re-thrown.
     *
     * @param err - An error returned by a LocalStore operation.
     * @returns A Promise that resolves after we recovered, or the original error.
     */ async function Tt(t) {
        if (t.code !== $.FAILED_PRECONDITION || t.message !== pt) throw t;
        D("LocalStore", "Unexpectedly lost primary lease");
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * PersistencePromise is essentially a re-implementation of Promise except
     * it has a .next() method instead of .then() and .next() and .catch() callbacks
     * are executed synchronously when a PersistencePromise resolves rather than
     * asynchronously (Promise implementations use setImmediate() or similar).
     *
     * This is necessary to interoperate with IndexedDB which will automatically
     * commit transactions if control is returned to the event loop without
     * synchronously initiating another operation on the transaction.
     *
     * NOTE: .then() and .catch() only allow a single consumer, unlike normal
     * Promises.
     */ class Et {
        constructor(t) {
            // NOTE: next/catchCallback will always point to our own wrapper functions,
            // not the user's raw next() or catch() callbacks.
            this.nextCallback = null, this.catchCallback = null, 
            // When the operation resolves, we'll set result or error and mark isDone.
            this.result = void 0, this.error = void 0, this.isDone = !1, 
            // Set to true when .then() or .catch() are called and prevents additional
            // chaining.
            this.callbackAttached = !1, t((t => {
                this.isDone = !0, this.result = t, this.nextCallback && 
                // value should be defined unless T is Void, but we can't express
                // that in the type system.
                this.nextCallback(t);
            }), (t => {
                this.isDone = !0, this.error = t, this.catchCallback && this.catchCallback(t);
            }));
        }
        catch(t) {
            return this.next(void 0, t);
        }
        next(t, e) {
            return this.callbackAttached && k(), this.callbackAttached = !0, this.isDone ? this.error ? this.wrapFailure(e, this.error) : this.wrapSuccess(t, this.result) : new Et(((n, s) => {
                this.nextCallback = e => {
                    this.wrapSuccess(t, e).next(n, s);
                }, this.catchCallback = t => {
                    this.wrapFailure(e, t).next(n, s);
                };
            }));
        }
        toPromise() {
            return new Promise(((t, e) => {
                this.next(t, e);
            }));
        }
        wrapUserFunction(t) {
            try {
                const e = t();
                return e instanceof Et ? e : Et.resolve(e);
            } catch (t) {
                return Et.reject(t);
            }
        }
        wrapSuccess(t, e) {
            return t ? this.wrapUserFunction((() => t(e))) : Et.resolve(e);
        }
        wrapFailure(t, e) {
            return t ? this.wrapUserFunction((() => t(e))) : Et.reject(e);
        }
        static resolve(t) {
            return new Et(((e, n) => {
                e(t);
            }));
        }
        static reject(t) {
            return new Et(((e, n) => {
                n(t);
            }));
        }
        static waitFor(
        // Accept all Promise types in waitFor().
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        t) {
            return new Et(((e, n) => {
                let s = 0, i = 0, r = !1;
                t.forEach((t => {
                    ++s, t.next((() => {
                        ++i, r && i === s && e();
                    }), (t => n(t)));
                })), r = !0, i === s && e();
            }));
        }
        /**
         * Given an array of predicate functions that asynchronously evaluate to a
         * boolean, implements a short-circuiting `or` between the results. Predicates
         * will be evaluated until one of them returns `true`, then stop. The final
         * result will be whether any of them returned `true`.
         */    static or(t) {
            let e = Et.resolve(!1);
            for (const n of t) e = e.next((t => t ? Et.resolve(t) : n()));
            return e;
        }
        static forEach(t, e) {
            const n = [];
            return t.forEach(((t, s) => {
                n.push(e.call(this, t, s));
            })), this.waitFor(n);
        }
        /**
         * Concurrently map all array elements through asynchronous function.
         */    static mapArray(t, e) {
            return new Et(((n, s) => {
                const i = t.length, r = new Array(i);
                let o = 0;
                for (let u = 0; u < i; u++) {
                    const c = u;
                    e(t[c]).next((t => {
                        r[c] = t, ++o, o === i && n(r);
                    }), (t => s(t)));
                }
            }));
        }
        /**
         * An alternative to recursive PersistencePromise calls, that avoids
         * potential memory problems from unbounded chains of promises.
         *
         * The `action` will be called repeatedly while `condition` is true.
         */    static doWhile(t, e) {
            return new Et(((n, s) => {
                const i = () => {
                    !0 === t() ? e().next((() => {
                        i();
                    }), s) : n();
                };
                i();
            }));
        }
    }

    /** Verifies whether `e` is an IndexedDbTransactionError. */ function vt(t) {
        // Use name equality, as instanceof checks on errors don't work with errors
        // that wrap other errors.
        return "IndexedDbTransactionError" === t.name;
    }

    /**
     * @license
     * Copyright 2018 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * `ListenSequence` is a monotonic sequence. It is initialized with a minimum value to
     * exceed. All subsequent calls to next will return increasing values. If provided with a
     * `SequenceNumberSyncer`, it will additionally bump its next value when told of a new value, as
     * well as write out sequence numbers that it produces via `next()`.
     */ class kt {
        constructor(t, e) {
            this.previousValue = t, e && (e.sequenceNumberHandler = t => this.ut(t), this.ct = t => e.writeSequenceNumber(t));
        }
        ut(t) {
            return this.previousValue = Math.max(t, this.previousValue), this.previousValue;
        }
        next() {
            const t = ++this.previousValue;
            return this.ct && this.ct(t), t;
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    function Mt(t) {
        let e = 0;
        for (const n in t) Object.prototype.hasOwnProperty.call(t, n) && e++;
        return e;
    }

    function Ot(t, e) {
        for (const n in t) Object.prototype.hasOwnProperty.call(t, n) && e(n, t[n]);
    }

    function Ft(t) {
        for (const e in t) if (Object.prototype.hasOwnProperty.call(t, e)) return !1;
        return !0;
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    // An immutable sorted map implementation, based on a Left-leaning Red-Black
    // tree.
    kt.at = -1;

    class $t {
        constructor(t, e) {
            this.comparator = t, this.root = e || Lt.EMPTY;
        }
        // Returns a copy of the map, with the specified key/value added or replaced.
        insert(t, e) {
            return new $t(this.comparator, this.root.insert(t, e, this.comparator).copy(null, null, Lt.BLACK, null, null));
        }
        // Returns a copy of the map, with the specified key removed.
        remove(t) {
            return new $t(this.comparator, this.root.remove(t, this.comparator).copy(null, null, Lt.BLACK, null, null));
        }
        // Returns the value of the node with the given key, or null.
        get(t) {
            let e = this.root;
            for (;!e.isEmpty(); ) {
                const n = this.comparator(t, e.key);
                if (0 === n) return e.value;
                n < 0 ? e = e.left : n > 0 && (e = e.right);
            }
            return null;
        }
        // Returns the index of the element in this sorted map, or -1 if it doesn't
        // exist.
        indexOf(t) {
            // Number of nodes that were pruned when descending right
            let e = 0, n = this.root;
            for (;!n.isEmpty(); ) {
                const s = this.comparator(t, n.key);
                if (0 === s) return e + n.left.size;
                s < 0 ? n = n.left : (
                // Count all nodes left of the node plus the node itself
                e += n.left.size + 1, n = n.right);
            }
            // Node not found
                    return -1;
        }
        isEmpty() {
            return this.root.isEmpty();
        }
        // Returns the total number of nodes in the map.
        get size() {
            return this.root.size;
        }
        // Returns the minimum key in the map.
        minKey() {
            return this.root.minKey();
        }
        // Returns the maximum key in the map.
        maxKey() {
            return this.root.maxKey();
        }
        // Traverses the map in key order and calls the specified action function
        // for each key/value pair. If action returns true, traversal is aborted.
        // Returns the first truthy value returned by action, or the last falsey
        // value returned by action.
        inorderTraversal(t) {
            return this.root.inorderTraversal(t);
        }
        forEach(t) {
            this.inorderTraversal(((e, n) => (t(e, n), !1)));
        }
        toString() {
            const t = [];
            return this.inorderTraversal(((e, n) => (t.push(`${e}:${n}`), !1))), `{${t.join(", ")}}`;
        }
        // Traverses the map in reverse key order and calls the specified action
        // function for each key/value pair. If action returns true, traversal is
        // aborted.
        // Returns the first truthy value returned by action, or the last falsey
        // value returned by action.
        reverseTraversal(t) {
            return this.root.reverseTraversal(t);
        }
        // Returns an iterator over the SortedMap.
        getIterator() {
            return new Bt(this.root, null, this.comparator, !1);
        }
        getIteratorFrom(t) {
            return new Bt(this.root, t, this.comparator, !1);
        }
        getReverseIterator() {
            return new Bt(this.root, null, this.comparator, !0);
        }
        getReverseIteratorFrom(t) {
            return new Bt(this.root, t, this.comparator, !0);
        }
    }

     // end SortedMap
    // An iterator over an LLRBNode.
    class Bt {
        constructor(t, e, n, s) {
            this.isReverse = s, this.nodeStack = [];
            let i = 1;
            for (;!t.isEmpty(); ) if (i = e ? n(t.key, e) : 1, 
            // flip the comparison if we're going in reverse
            e && s && (i *= -1), i < 0) 
            // This node is less than our start key. ignore it
            t = this.isReverse ? t.left : t.right; else {
                if (0 === i) {
                    // This node is exactly equal to our start key. Push it on the stack,
                    // but stop iterating;
                    this.nodeStack.push(t);
                    break;
                }
                // This node is greater than our start key, add it to the stack and move
                // to the next one
                this.nodeStack.push(t), t = this.isReverse ? t.right : t.left;
            }
        }
        getNext() {
            let t = this.nodeStack.pop();
            const e = {
                key: t.key,
                value: t.value
            };
            if (this.isReverse) for (t = t.left; !t.isEmpty(); ) this.nodeStack.push(t), t = t.right; else for (t = t.right; !t.isEmpty(); ) this.nodeStack.push(t), 
            t = t.left;
            return e;
        }
        hasNext() {
            return this.nodeStack.length > 0;
        }
        peek() {
            if (0 === this.nodeStack.length) return null;
            const t = this.nodeStack[this.nodeStack.length - 1];
            return {
                key: t.key,
                value: t.value
            };
        }
    }

     // end SortedMapIterator
    // Represents a node in a Left-leaning Red-Black tree.
    class Lt {
        constructor(t, e, n, s, i) {
            this.key = t, this.value = e, this.color = null != n ? n : Lt.RED, this.left = null != s ? s : Lt.EMPTY, 
            this.right = null != i ? i : Lt.EMPTY, this.size = this.left.size + 1 + this.right.size;
        }
        // Returns a copy of the current node, optionally replacing pieces of it.
        copy(t, e, n, s, i) {
            return new Lt(null != t ? t : this.key, null != e ? e : this.value, null != n ? n : this.color, null != s ? s : this.left, null != i ? i : this.right);
        }
        isEmpty() {
            return !1;
        }
        // Traverses the tree in key order and calls the specified action function
        // for each node. If action returns true, traversal is aborted.
        // Returns the first truthy value returned by action, or the last falsey
        // value returned by action.
        inorderTraversal(t) {
            return this.left.inorderTraversal(t) || t(this.key, this.value) || this.right.inorderTraversal(t);
        }
        // Traverses the tree in reverse key order and calls the specified action
        // function for each node. If action returns true, traversal is aborted.
        // Returns the first truthy value returned by action, or the last falsey
        // value returned by action.
        reverseTraversal(t) {
            return this.right.reverseTraversal(t) || t(this.key, this.value) || this.left.reverseTraversal(t);
        }
        // Returns the minimum node in the tree.
        min() {
            return this.left.isEmpty() ? this : this.left.min();
        }
        // Returns the maximum key in the tree.
        minKey() {
            return this.min().key;
        }
        // Returns the maximum key in the tree.
        maxKey() {
            return this.right.isEmpty() ? this.key : this.right.maxKey();
        }
        // Returns new tree, with the key/value added.
        insert(t, e, n) {
            let s = this;
            const i = n(t, s.key);
            return s = i < 0 ? s.copy(null, null, null, s.left.insert(t, e, n), null) : 0 === i ? s.copy(null, e, null, null, null) : s.copy(null, null, null, null, s.right.insert(t, e, n)), 
            s.fixUp();
        }
        removeMin() {
            if (this.left.isEmpty()) return Lt.EMPTY;
            let t = this;
            return t.left.isRed() || t.left.left.isRed() || (t = t.moveRedLeft()), t = t.copy(null, null, null, t.left.removeMin(), null), 
            t.fixUp();
        }
        // Returns new tree, with the specified item removed.
        remove(t, e) {
            let n, s = this;
            if (e(t, s.key) < 0) s.left.isEmpty() || s.left.isRed() || s.left.left.isRed() || (s = s.moveRedLeft()), 
            s = s.copy(null, null, null, s.left.remove(t, e), null); else {
                if (s.left.isRed() && (s = s.rotateRight()), s.right.isEmpty() || s.right.isRed() || s.right.left.isRed() || (s = s.moveRedRight()), 
                0 === e(t, s.key)) {
                    if (s.right.isEmpty()) return Lt.EMPTY;
                    n = s.right.min(), s = s.copy(n.key, n.value, null, null, s.right.removeMin());
                }
                s = s.copy(null, null, null, null, s.right.remove(t, e));
            }
            return s.fixUp();
        }
        isRed() {
            return this.color;
        }
        // Returns new tree after performing any needed rotations.
        fixUp() {
            let t = this;
            return t.right.isRed() && !t.left.isRed() && (t = t.rotateLeft()), t.left.isRed() && t.left.left.isRed() && (t = t.rotateRight()), 
            t.left.isRed() && t.right.isRed() && (t = t.colorFlip()), t;
        }
        moveRedLeft() {
            let t = this.colorFlip();
            return t.right.left.isRed() && (t = t.copy(null, null, null, null, t.right.rotateRight()), 
            t = t.rotateLeft(), t = t.colorFlip()), t;
        }
        moveRedRight() {
            let t = this.colorFlip();
            return t.left.left.isRed() && (t = t.rotateRight(), t = t.colorFlip()), t;
        }
        rotateLeft() {
            const t = this.copy(null, null, Lt.RED, null, this.right.left);
            return this.right.copy(null, null, this.color, t, null);
        }
        rotateRight() {
            const t = this.copy(null, null, Lt.RED, this.left.right, null);
            return this.left.copy(null, null, this.color, null, t);
        }
        colorFlip() {
            const t = this.left.copy(null, null, !this.left.color, null, null), e = this.right.copy(null, null, !this.right.color, null, null);
            return this.copy(null, null, !this.color, t, e);
        }
        // For testing.
        checkMaxDepth() {
            const t = this.check();
            return Math.pow(2, t) <= this.size + 1;
        }
        // In a balanced RB tree, the black-depth (number of black nodes) from root to
        // leaves is equal on both sides.  This function verifies that or asserts.
        check() {
            if (this.isRed() && this.left.isRed()) throw k();
            if (this.right.isRed()) throw k();
            const t = this.left.check();
            if (t !== this.right.check()) throw k();
            return t + (this.isRed() ? 0 : 1);
        }
    }

     // end LLRBNode
    // Empty node is shared between all LLRB trees.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Lt.EMPTY = null, Lt.RED = !0, Lt.BLACK = !1;

    // end LLRBEmptyNode
    Lt.EMPTY = new 
    // Represents an empty node (a leaf node in the Red-Black Tree).
    class {
        constructor() {
            this.size = 0;
        }
        get key() {
            throw k();
        }
        get value() {
            throw k();
        }
        get color() {
            throw k();
        }
        get left() {
            throw k();
        }
        get right() {
            throw k();
        }
        // Returns a copy of the current node.
        copy(t, e, n, s, i) {
            return this;
        }
        // Returns a copy of the tree, with the specified key/value added.
        insert(t, e, n) {
            return new Lt(t, e);
        }
        // Returns a copy of the tree, with the specified key removed.
        remove(t, e) {
            return this;
        }
        isEmpty() {
            return !0;
        }
        inorderTraversal(t) {
            return !1;
        }
        reverseTraversal(t) {
            return !1;
        }
        minKey() {
            return null;
        }
        maxKey() {
            return null;
        }
        isRed() {
            return !1;
        }
        // For testing.
        checkMaxDepth() {
            return !0;
        }
        check() {
            return 0;
        }
    };

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * SortedSet is an immutable (copy-on-write) collection that holds elements
     * in order specified by the provided comparator.
     *
     * NOTE: if provided comparator returns 0 for two elements, we consider them to
     * be equal!
     */
    class Ut {
        constructor(t) {
            this.comparator = t, this.data = new $t(this.comparator);
        }
        has(t) {
            return null !== this.data.get(t);
        }
        first() {
            return this.data.minKey();
        }
        last() {
            return this.data.maxKey();
        }
        get size() {
            return this.data.size;
        }
        indexOf(t) {
            return this.data.indexOf(t);
        }
        /** Iterates elements in order defined by "comparator" */    forEach(t) {
            this.data.inorderTraversal(((e, n) => (t(e), !1)));
        }
        /** Iterates over `elem`s such that: range[0] &lt;= elem &lt; range[1]. */    forEachInRange(t, e) {
            const n = this.data.getIteratorFrom(t[0]);
            for (;n.hasNext(); ) {
                const s = n.getNext();
                if (this.comparator(s.key, t[1]) >= 0) return;
                e(s.key);
            }
        }
        /**
         * Iterates over `elem`s such that: start &lt;= elem until false is returned.
         */    forEachWhile(t, e) {
            let n;
            for (n = void 0 !== e ? this.data.getIteratorFrom(e) : this.data.getIterator(); n.hasNext(); ) {
                if (!t(n.getNext().key)) return;
            }
        }
        /** Finds the least element greater than or equal to `elem`. */    firstAfterOrEqual(t) {
            const e = this.data.getIteratorFrom(t);
            return e.hasNext() ? e.getNext().key : null;
        }
        getIterator() {
            return new qt(this.data.getIterator());
        }
        getIteratorFrom(t) {
            return new qt(this.data.getIteratorFrom(t));
        }
        /** Inserts or updates an element */    add(t) {
            return this.copy(this.data.remove(t).insert(t, !0));
        }
        /** Deletes an element */    delete(t) {
            return this.has(t) ? this.copy(this.data.remove(t)) : this;
        }
        isEmpty() {
            return this.data.isEmpty();
        }
        unionWith(t) {
            let e = this;
            // Make sure `result` always refers to the larger one of the two sets.
                    return e.size < t.size && (e = t, t = this), t.forEach((t => {
                e = e.add(t);
            })), e;
        }
        isEqual(t) {
            if (!(t instanceof Ut)) return !1;
            if (this.size !== t.size) return !1;
            const e = this.data.getIterator(), n = t.data.getIterator();
            for (;e.hasNext(); ) {
                const t = e.getNext().key, s = n.getNext().key;
                if (0 !== this.comparator(t, s)) return !1;
            }
            return !0;
        }
        toArray() {
            const t = [];
            return this.forEach((e => {
                t.push(e);
            })), t;
        }
        toString() {
            const t = [];
            return this.forEach((e => t.push(e))), "SortedSet(" + t.toString() + ")";
        }
        copy(t) {
            const e = new Ut(this.comparator);
            return e.data = t, e;
        }
    }

    class qt {
        constructor(t) {
            this.iter = t;
        }
        getNext() {
            return this.iter.getNext().key;
        }
        hasNext() {
            return this.iter.hasNext();
        }
    }

    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Provides a set of fields that can be used to partially patch a document.
     * FieldMask is used in conjunction with ObjectValue.
     * Examples:
     *   foo - Overwrites foo entirely with the provided value. If foo is not
     *         present in the companion ObjectValue, the field is deleted.
     *   foo.bar - Overwrites only the field bar of the object foo.
     *             If foo is not an object, foo is replaced with an object
     *             containing foo
     */ class Gt {
        constructor(t) {
            this.fields = t, 
            // TODO(dimond): validation of FieldMask
            // Sort the field mask to support `FieldMask.isEqual()` and assert below.
            t.sort(ot.comparator);
        }
        static empty() {
            return new Gt([]);
        }
        /**
         * Returns a new FieldMask object that is the result of adding all the given
         * fields paths to this field mask.
         */    unionWith(t) {
            let e = new Ut(ot.comparator);
            for (const t of this.fields) e = e.add(t);
            for (const n of t) e = e.add(n);
            return new Gt(e.toArray());
        }
        /**
         * Verifies that `fieldPath` is included by at least one field in this field
         * mask.
         *
         * This is an O(n) operation, where `n` is the size of the field mask.
         */    covers(t) {
            for (const e of this.fields) if (e.isPrefixOf(t)) return !0;
            return !1;
        }
        isEqual(t) {
            return Z(this.fields, t.fields, ((t, e) => t.isEqual(e)));
        }
    }

    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Immutable class that represents a "proto" byte string.
     *
     * Proto byte strings can either be Base64-encoded strings or Uint8Arrays when
     * sent on the wire. This class abstracts away this differentiation by holding
     * the proto byte string in a common class that must be converted into a string
     * before being sent as a proto.
     * @internal
     */ class jt {
        constructor(t) {
            this.binaryString = t;
        }
        static fromBase64String(t) {
            const e = atob(t);
            return new jt(e);
        }
        static fromUint8Array(t) {
            // TODO(indexing); Remove the copy of the byte string here as this method
            // is frequently called during indexing.
            const e = 
            /**
     * Helper function to convert an Uint8array to a binary string.
     */
            function(t) {
                let e = "";
                for (let n = 0; n < t.length; ++n) e += String.fromCharCode(t[n]);
                return e;
            }
            /**
     * Helper function to convert a binary string to an Uint8Array.
     */ (t);
            return new jt(e);
        }
        [Symbol.iterator]() {
            let t = 0;
            return {
                next: () => t < this.binaryString.length ? {
                    value: this.binaryString.charCodeAt(t++),
                    done: !1
                } : {
                    value: void 0,
                    done: !0
                }
            };
        }
        toBase64() {
            return t = this.binaryString, btoa(t);
            /** Converts a binary string to a Base64 encoded string. */
            var t;
        }
        toUint8Array() {
            return function(t) {
                const e = new Uint8Array(t.length);
                for (let n = 0; n < t.length; n++) e[n] = t.charCodeAt(n);
                return e;
            }
            /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
            // A RegExp matching ISO 8601 UTC timestamps with optional fraction.
            (this.binaryString);
        }
        approximateByteSize() {
            return 2 * this.binaryString.length;
        }
        compareTo(t) {
            return X(this.binaryString, t.binaryString);
        }
        isEqual(t) {
            return this.binaryString === t.binaryString;
        }
    }

    jt.EMPTY_BYTE_STRING = new jt("");

    const Wt = new RegExp(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.(\d+))?Z$/);

    /**
     * Converts the possible Proto values for a timestamp value into a "seconds and
     * nanos" representation.
     */ function zt(t) {
        // The json interface (for the browser) will return an iso timestamp string,
        // while the proto js library (for node) will return a
        // google.protobuf.Timestamp instance.
        if (M(!!t), "string" == typeof t) {
            // The date string can have higher precision (nanos) than the Date class
            // (millis), so we do some custom parsing here.
            // Parse the nanos right out of the string.
            let e = 0;
            const n = Wt.exec(t);
            if (M(!!n), n[1]) {
                // Pad the fraction out to 9 digits (nanos).
                let t = n[1];
                t = (t + "000000000").substr(0, 9), e = Number(t);
            }
            // Parse the date to get the seconds.
                    const s = new Date(t);
            return {
                seconds: Math.floor(s.getTime() / 1e3),
                nanos: e
            };
        }
        return {
            seconds: Ht(t.seconds),
            nanos: Ht(t.nanos)
        };
    }

    /**
     * Converts the possible Proto types for numbers into a JavaScript number.
     * Returns 0 if the value is not numeric.
     */ function Ht(t) {
        // TODO(bjornick): Handle int64 greater than 53 bits.
        return "number" == typeof t ? t : "string" == typeof t ? Number(t) : 0;
    }

    /** Converts the possible Proto types for Blobs into a ByteString. */ function Jt(t) {
        return "string" == typeof t ? jt.fromBase64String(t) : jt.fromUint8Array(t);
    }

    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Represents a locally-applied ServerTimestamp.
     *
     * Server Timestamps are backed by MapValues that contain an internal field
     * `__type__` with a value of `server_timestamp`. The previous value and local
     * write time are stored in its `__previous_value__` and `__local_write_time__`
     * fields respectively.
     *
     * Notes:
     * - ServerTimestampValue instances are created as the result of applying a
     *   transform. They can only exist in the local view of a document. Therefore
     *   they do not need to be parsed or serialized.
     * - When evaluated locally (e.g. for snapshot.data()), they by default
     *   evaluate to `null`. This behavior can be configured by passing custom
     *   FieldValueOptions to value().
     * - With respect to other ServerTimestampValues, they sort by their
     *   localWriteTime.
     */ function Yt(t) {
        var e, n;
        return "server_timestamp" === (null === (n = ((null === (e = null == t ? void 0 : t.mapValue) || void 0 === e ? void 0 : e.fields) || {}).__type__) || void 0 === n ? void 0 : n.stringValue);
    }

    /**
     * Creates a new ServerTimestamp proto value (using the internal format).
     */
    /**
     * Returns the value of the field before this ServerTimestamp was set.
     *
     * Preserving the previous values allows the user to display the last resoled
     * value until the backend responds with the timestamp.
     */
    function Xt(t) {
        const e = t.mapValue.fields.__previous_value__;
        return Yt(e) ? Xt(e) : e;
    }

    /**
     * Returns the local time at which this timestamp was first set.
     */ function Zt(t) {
        const e = zt(t.mapValue.fields.__local_write_time__.timestampValue);
        return new et(e.seconds, e.nanos);
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */ class te {
        /**
         * Constructs a DatabaseInfo using the provided host, databaseId and
         * persistenceKey.
         *
         * @param databaseId - The database to use.
         * @param appId - The Firebase App Id.
         * @param persistenceKey - A unique identifier for this Firestore's local
         * storage (used in conjunction with the databaseId).
         * @param host - The Firestore backend host to connect to.
         * @param ssl - Whether to use SSL when connecting.
         * @param forceLongPolling - Whether to use the forceLongPolling option
         * when using WebChannel as the network transport.
         * @param autoDetectLongPolling - Whether to use the detectBufferingProxy
         * option when using WebChannel as the network transport.
         * @param useFetchStreams Whether to use the Fetch API instead of
         * XMLHTTPRequest
         */
        constructor(t, e, n, s, i, r, o, u) {
            this.databaseId = t, this.appId = e, this.persistenceKey = n, this.host = s, this.ssl = i, 
            this.forceLongPolling = r, this.autoDetectLongPolling = o, this.useFetchStreams = u;
        }
    }

    /** The default database name for a project. */
    /**
     * Represents the database ID a Firestore client is associated with.
     * @internal
     */
    class ee {
        constructor(t, e) {
            this.projectId = t, this.database = e || "(default)";
        }
        static empty() {
            return new ee("", "");
        }
        get isDefaultDatabase() {
            return "(default)" === this.database;
        }
        isEqual(t) {
            return t instanceof ee && t.projectId === this.projectId && t.database === this.database;
        }
    }

    /**
     * Returns whether a variable is either undefined or null.
     */
    function ne(t) {
        return null == t;
    }

    /** Returns whether the value represents -0. */ function se(t) {
        // Detect if the value is -0.0. Based on polyfill from
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is
        return 0 === t && 1 / t == -1 / 0;
    }

    /**
     * Returns whether a value is an integer and in the safe integer range
     * @param value - The value to test for being an integer and in the safe range
     */ function ie(t) {
        return "number" == typeof t && Number.isInteger(t) && !se(t) && t <= Number.MAX_SAFE_INTEGER && t >= Number.MIN_SAFE_INTEGER;
    }

    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */ const re = {
        mapValue: {
            fields: {
                __type__: {
                    stringValue: "__max__"
                }
            }
        }
    };

    /** Extracts the backend's type order for the provided value. */
    function ue(t) {
        return "nullValue" in t ? 0 /* NullValue */ : "booleanValue" in t ? 1 /* BooleanValue */ : "integerValue" in t || "doubleValue" in t ? 2 /* NumberValue */ : "timestampValue" in t ? 3 /* TimestampValue */ : "stringValue" in t ? 5 /* StringValue */ : "bytesValue" in t ? 6 /* BlobValue */ : "referenceValue" in t ? 7 /* RefValue */ : "geoPointValue" in t ? 8 /* GeoPointValue */ : "arrayValue" in t ? 9 /* ArrayValue */ : "mapValue" in t ? Yt(t) ? 4 /* ServerTimestampValue */ : Te(t) ? 9007199254740991 /* MaxValue */ : 10 /* ObjectValue */ : k();
    }

    /** Tests `left` and `right` for equality based on the backend semantics. */ function ce(t, e) {
        if (t === e) return !0;
        const n = ue(t);
        if (n !== ue(e)) return !1;
        switch (n) {
          case 0 /* NullValue */ :
          case 9007199254740991 /* MaxValue */ :
            return !0;

          case 1 /* BooleanValue */ :
            return t.booleanValue === e.booleanValue;

          case 4 /* ServerTimestampValue */ :
            return Zt(t).isEqual(Zt(e));

          case 3 /* TimestampValue */ :
            return function(t, e) {
                if ("string" == typeof t.timestampValue && "string" == typeof e.timestampValue && t.timestampValue.length === e.timestampValue.length) 
                // Use string equality for ISO 8601 timestamps
                return t.timestampValue === e.timestampValue;
                const n = zt(t.timestampValue), s = zt(e.timestampValue);
                return n.seconds === s.seconds && n.nanos === s.nanos;
            }(t, e);

          case 5 /* StringValue */ :
            return t.stringValue === e.stringValue;

          case 6 /* BlobValue */ :
            return function(t, e) {
                return Jt(t.bytesValue).isEqual(Jt(e.bytesValue));
            }(t, e);

          case 7 /* RefValue */ :
            return t.referenceValue === e.referenceValue;

          case 8 /* GeoPointValue */ :
            return function(t, e) {
                return Ht(t.geoPointValue.latitude) === Ht(e.geoPointValue.latitude) && Ht(t.geoPointValue.longitude) === Ht(e.geoPointValue.longitude);
            }(t, e);

          case 2 /* NumberValue */ :
            return function(t, e) {
                if ("integerValue" in t && "integerValue" in e) return Ht(t.integerValue) === Ht(e.integerValue);
                if ("doubleValue" in t && "doubleValue" in e) {
                    const n = Ht(t.doubleValue), s = Ht(e.doubleValue);
                    return n === s ? se(n) === se(s) : isNaN(n) && isNaN(s);
                }
                return !1;
            }(t, e);

          case 9 /* ArrayValue */ :
            return Z(t.arrayValue.values || [], e.arrayValue.values || [], ce);

          case 10 /* ObjectValue */ :
            return function(t, e) {
                const n = t.mapValue.fields || {}, s = e.mapValue.fields || {};
                if (Mt(n) !== Mt(s)) return !1;
                for (const t in n) if (n.hasOwnProperty(t) && (void 0 === s[t] || !ce(n[t], s[t]))) return !1;
                return !0;
            }
            /** Returns true if the ArrayValue contains the specified element. */ (t, e);

          default:
            return k();
        }
    }

    function ae(t, e) {
        return void 0 !== (t.values || []).find((t => ce(t, e)));
    }

    function he(t, e) {
        if (t === e) return 0;
        const n = ue(t), s = ue(e);
        if (n !== s) return X(n, s);
        switch (n) {
          case 0 /* NullValue */ :
          case 9007199254740991 /* MaxValue */ :
            return 0;

          case 1 /* BooleanValue */ :
            return X(t.booleanValue, e.booleanValue);

          case 2 /* NumberValue */ :
            return function(t, e) {
                const n = Ht(t.integerValue || t.doubleValue), s = Ht(e.integerValue || e.doubleValue);
                return n < s ? -1 : n > s ? 1 : n === s ? 0 : 
                // one or both are NaN.
                isNaN(n) ? isNaN(s) ? 0 : -1 : 1;
            }(t, e);

          case 3 /* TimestampValue */ :
            return le(t.timestampValue, e.timestampValue);

          case 4 /* ServerTimestampValue */ :
            return le(Zt(t), Zt(e));

          case 5 /* StringValue */ :
            return X(t.stringValue, e.stringValue);

          case 6 /* BlobValue */ :
            return function(t, e) {
                const n = Jt(t), s = Jt(e);
                return n.compareTo(s);
            }(t.bytesValue, e.bytesValue);

          case 7 /* RefValue */ :
            return function(t, e) {
                const n = t.split("/"), s = e.split("/");
                for (let t = 0; t < n.length && t < s.length; t++) {
                    const e = X(n[t], s[t]);
                    if (0 !== e) return e;
                }
                return X(n.length, s.length);
            }(t.referenceValue, e.referenceValue);

          case 8 /* GeoPointValue */ :
            return function(t, e) {
                const n = X(Ht(t.latitude), Ht(e.latitude));
                if (0 !== n) return n;
                return X(Ht(t.longitude), Ht(e.longitude));
            }(t.geoPointValue, e.geoPointValue);

          case 9 /* ArrayValue */ :
            return function(t, e) {
                const n = t.values || [], s = e.values || [];
                for (let t = 0; t < n.length && t < s.length; ++t) {
                    const e = he(n[t], s[t]);
                    if (e) return e;
                }
                return X(n.length, s.length);
            }(t.arrayValue, e.arrayValue);

          case 10 /* ObjectValue */ :
            return function(t, e) {
                if (t === re.mapValue && e === re.mapValue) return 0;
                if (t === re.mapValue) return 1;
                if (e === re.mapValue) return -1;
                const n = t.fields || {}, s = Object.keys(n), i = e.fields || {}, r = Object.keys(i);
                // Even though MapValues are likely sorted correctly based on their insertion
                // order (e.g. when received from the backend), local modifications can bring
                // elements out of order. We need to re-sort the elements to ensure that
                // canonical IDs are independent of insertion order.
                s.sort(), r.sort();
                for (let t = 0; t < s.length && t < r.length; ++t) {
                    const e = X(s[t], r[t]);
                    if (0 !== e) return e;
                    const o = he(n[s[t]], i[r[t]]);
                    if (0 !== o) return o;
                }
                return X(s.length, r.length);
            }
            /**
     * Generates the canonical ID for the provided field value (as used in Target
     * serialization).
     */ (t.mapValue, e.mapValue);

          default:
            throw k();
        }
    }

    function le(t, e) {
        if ("string" == typeof t && "string" == typeof e && t.length === e.length) return X(t, e);
        const n = zt(t), s = zt(e), i = X(n.seconds, s.seconds);
        return 0 !== i ? i : X(n.nanos, s.nanos);
    }

    function fe(t) {
        return de(t);
    }

    function de(t) {
        return "nullValue" in t ? "null" : "booleanValue" in t ? "" + t.booleanValue : "integerValue" in t ? "" + t.integerValue : "doubleValue" in t ? "" + t.doubleValue : "timestampValue" in t ? function(t) {
            const e = zt(t);
            return `time(${e.seconds},${e.nanos})`;
        }(t.timestampValue) : "stringValue" in t ? t.stringValue : "bytesValue" in t ? Jt(t.bytesValue).toBase64() : "referenceValue" in t ? (n = t.referenceValue, 
        ut.fromName(n).toString()) : "geoPointValue" in t ? `geo(${(e = t.geoPointValue).latitude},${e.longitude})` : "arrayValue" in t ? function(t) {
            let e = "[", n = !0;
            for (const s of t.values || []) n ? n = !1 : e += ",", e += de(s);
            return e + "]";
        }
        /** Returns a reference value for the provided database and key. */ (t.arrayValue) : "mapValue" in t ? function(t) {
            // Iteration order in JavaScript is not guaranteed. To ensure that we generate
            // matching canonical IDs for identical maps, we need to sort the keys.
            const e = Object.keys(t.fields || {}).sort();
            let n = "{", s = !0;
            for (const i of e) s ? s = !1 : n += ",", n += `${i}:${de(t.fields[i])}`;
            return n + "}";
        }(t.mapValue) : k();
        var e, n;
    }

    /** Returns true if `value` is an IntegerValue . */ function we(t) {
        return !!t && "integerValue" in t;
    }

    /** Returns true if `value` is a DoubleValue. */
    /** Returns true if `value` is an ArrayValue. */
    function me(t) {
        return !!t && "arrayValue" in t;
    }

    /** Returns true if `value` is a NullValue. */ function ge(t) {
        return !!t && "nullValue" in t;
    }

    /** Returns true if `value` is NaN. */ function ye(t) {
        return !!t && "doubleValue" in t && isNaN(Number(t.doubleValue));
    }

    /** Returns true if `value` is a MapValue. */ function pe(t) {
        return !!t && "mapValue" in t;
    }

    /** Creates a deep copy of `source`. */ function Ie(t) {
        if (t.geoPointValue) return {
            geoPointValue: Object.assign({}, t.geoPointValue)
        };
        if (t.timestampValue && "object" == typeof t.timestampValue) return {
            timestampValue: Object.assign({}, t.timestampValue)
        };
        if (t.mapValue) {
            const e = {
                mapValue: {
                    fields: {}
                }
            };
            return Ot(t.mapValue.fields, ((t, n) => e.mapValue.fields[t] = Ie(n))), e;
        }
        if (t.arrayValue) {
            const e = {
                arrayValue: {
                    values: []
                }
            };
            for (let n = 0; n < (t.arrayValue.values || []).length; ++n) e.arrayValue.values[n] = Ie(t.arrayValue.values[n]);
            return e;
        }
        return Object.assign({}, t);
    }

    /** Returns true if the Value represents the canonical {@link #MAX_VALUE} . */ function Te(t) {
        return "__max__" === (((t.mapValue || {}).fields || {}).__type__ || {}).stringValue;
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * An ObjectValue represents a MapValue in the Firestore Proto and offers the
     * ability to add and remove fields (via the ObjectValueBuilder).
     */ class Pe {
        constructor(t) {
            this.value = t;
        }
        static empty() {
            return new Pe({
                mapValue: {}
            });
        }
        /**
         * Returns the value at the given path or null.
         *
         * @param path - the path to search
         * @returns The value at the path or null if the path is not set.
         */    field(t) {
            if (t.isEmpty()) return this.value;
            {
                let e = this.value;
                for (let n = 0; n < t.length - 1; ++n) if (e = (e.mapValue.fields || {})[t.get(n)], 
                !pe(e)) return null;
                return e = (e.mapValue.fields || {})[t.lastSegment()], e || null;
            }
        }
        /**
         * Sets the field to the provided value.
         *
         * @param path - The field path to set.
         * @param value - The value to set.
         */    set(t, e) {
            this.getFieldsMap(t.popLast())[t.lastSegment()] = Ie(e);
        }
        /**
         * Sets the provided fields to the provided values.
         *
         * @param data - A map of fields to values (or null for deletes).
         */    setAll(t) {
            let e = ot.emptyPath(), n = {}, s = [];
            t.forEach(((t, i) => {
                if (!e.isImmediateParentOf(i)) {
                    // Insert the accumulated changes at this parent location
                    const t = this.getFieldsMap(e);
                    this.applyChanges(t, n, s), n = {}, s = [], e = i.popLast();
                }
                t ? n[i.lastSegment()] = Ie(t) : s.push(i.lastSegment());
            }));
            const i = this.getFieldsMap(e);
            this.applyChanges(i, n, s);
        }
        /**
         * Removes the field at the specified path. If there is no field at the
         * specified path, nothing is changed.
         *
         * @param path - The field path to remove.
         */    delete(t) {
            const e = this.field(t.popLast());
            pe(e) && e.mapValue.fields && delete e.mapValue.fields[t.lastSegment()];
        }
        isEqual(t) {
            return ce(this.value, t.value);
        }
        /**
         * Returns the map that contains the leaf element of `path`. If the parent
         * entry does not yet exist, or if it is not a map, a new map will be created.
         */    getFieldsMap(t) {
            let e = this.value;
            e.mapValue.fields || (e.mapValue = {
                fields: {}
            });
            for (let n = 0; n < t.length; ++n) {
                let s = e.mapValue.fields[t.get(n)];
                pe(s) && s.mapValue.fields || (s = {
                    mapValue: {
                        fields: {}
                    }
                }, e.mapValue.fields[t.get(n)] = s), e = s;
            }
            return e.mapValue.fields;
        }
        /**
         * Modifies `fieldsMap` by adding, replacing or deleting the specified
         * entries.
         */    applyChanges(t, e, n) {
            Ot(e, ((e, n) => t[e] = n));
            for (const e of n) delete t[e];
        }
        clone() {
            return new Pe(Ie(this.value));
        }
    }

    /**
     * Returns a FieldMask built from all fields in a MapValue.
     */ function ve(t) {
        const e = [];
        return Ot(t.fields, ((t, n) => {
            const s = new ot([ t ]);
            if (pe(n)) {
                const t = ve(n.mapValue).fields;
                if (0 === t.length) 
                // Preserve the empty map by adding it to the FieldMask.
                e.push(s); else 
                // For nested and non-empty ObjectValues, add the FieldPath of the
                // leaf nodes.
                for (const n of t) e.push(s.child(n));
            } else 
            // For nested and non-empty ObjectValues, add the FieldPath of the leaf
            // nodes.
            e.push(s);
        })), new Gt(e);
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Represents a document in Firestore with a key, version, data and whether it
     * has local mutations applied to it.
     *
     * Documents can transition between states via `convertToFoundDocument()`,
     * `convertToNoDocument()` and `convertToUnknownDocument()`. If a document does
     * not transition to one of these states even after all mutations have been
     * applied, `isValidDocument()` returns false and the document should be removed
     * from all views.
     */ class Ve {
        constructor(t, e, n, s, i, r) {
            this.key = t, this.documentType = e, this.version = n, this.readTime = s, this.data = i, 
            this.documentState = r;
        }
        /**
         * Creates a document with no known version or data, but which can serve as
         * base document for mutations.
         */    static newInvalidDocument(t) {
            return new Ve(t, 0 /* INVALID */ , nt.min(), nt.min(), Pe.empty(), 0 /* SYNCED */);
        }
        /**
         * Creates a new document that is known to exist with the given data at the
         * given version.
         */    static newFoundDocument(t, e, n) {
            return new Ve(t, 1 /* FOUND_DOCUMENT */ , e, nt.min(), n, 0 /* SYNCED */);
        }
        /** Creates a new document that is known to not exist at the given version. */    static newNoDocument(t, e) {
            return new Ve(t, 2 /* NO_DOCUMENT */ , e, nt.min(), Pe.empty(), 0 /* SYNCED */);
        }
        /**
         * Creates a new document that is known to exist at the given version but
         * whose data is not known (e.g. a document that was updated without a known
         * base document).
         */    static newUnknownDocument(t, e) {
            return new Ve(t, 3 /* UNKNOWN_DOCUMENT */ , e, nt.min(), Pe.empty(), 2 /* HAS_COMMITTED_MUTATIONS */);
        }
        /**
         * Changes the document type to indicate that it exists and that its version
         * and data are known.
         */    convertToFoundDocument(t, e) {
            return this.version = t, this.documentType = 1 /* FOUND_DOCUMENT */ , this.data = e, 
            this.documentState = 0 /* SYNCED */ , this;
        }
        /**
         * Changes the document type to indicate that it doesn't exist at the given
         * version.
         */    convertToNoDocument(t) {
            return this.version = t, this.documentType = 2 /* NO_DOCUMENT */ , this.data = Pe.empty(), 
            this.documentState = 0 /* SYNCED */ , this;
        }
        /**
         * Changes the document type to indicate that it exists at a given version but
         * that its data is not known (e.g. a document that was updated without a known
         * base document).
         */    convertToUnknownDocument(t) {
            return this.version = t, this.documentType = 3 /* UNKNOWN_DOCUMENT */ , this.data = Pe.empty(), 
            this.documentState = 2 /* HAS_COMMITTED_MUTATIONS */ , this;
        }
        setHasCommittedMutations() {
            return this.documentState = 2 /* HAS_COMMITTED_MUTATIONS */ , this;
        }
        setHasLocalMutations() {
            return this.documentState = 1 /* HAS_LOCAL_MUTATIONS */ , this.version = nt.min(), 
            this;
        }
        setReadTime(t) {
            return this.readTime = t, this;
        }
        get hasLocalMutations() {
            return 1 /* HAS_LOCAL_MUTATIONS */ === this.documentState;
        }
        get hasCommittedMutations() {
            return 2 /* HAS_COMMITTED_MUTATIONS */ === this.documentState;
        }
        get hasPendingWrites() {
            return this.hasLocalMutations || this.hasCommittedMutations;
        }
        isValidDocument() {
            return 0 /* INVALID */ !== this.documentType;
        }
        isFoundDocument() {
            return 1 /* FOUND_DOCUMENT */ === this.documentType;
        }
        isNoDocument() {
            return 2 /* NO_DOCUMENT */ === this.documentType;
        }
        isUnknownDocument() {
            return 3 /* UNKNOWN_DOCUMENT */ === this.documentType;
        }
        isEqual(t) {
            return t instanceof Ve && this.key.isEqual(t.key) && this.version.isEqual(t.version) && this.documentType === t.documentType && this.documentState === t.documentState && this.data.isEqual(t.data);
        }
        mutableCopy() {
            return new Ve(this.key, this.documentType, this.version, this.readTime, this.data.clone(), this.documentState);
        }
        toString() {
            return `Document(${this.key}, ${this.version}, ${JSON.stringify(this.data.value)}, {documentType: ${this.documentType}}), {documentState: ${this.documentState}})`;
        }
    }

    /**
     * Compares the value for field `field` in the provided documents. Throws if
     * the field does not exist in both documents.
     */
    /**
     * @license
     * Copyright 2019 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    // Visible for testing
    class Se {
        constructor(t, e = null, n = [], s = [], i = null, r = null, o = null) {
            this.path = t, this.collectionGroup = e, this.orderBy = n, this.filters = s, this.limit = i, 
            this.startAt = r, this.endAt = o, this.ht = null;
        }
    }

    /**
     * Initializes a Target with a path and optional additional query constraints.
     * Path must currently be empty if this is a collection group query.
     *
     * NOTE: you should always construct `Target` from `Query.toTarget` instead of
     * using this factory method, because `Query` provides an implicit `orderBy`
     * property.
     */ function De(t, e = null, n = [], s = [], i = null, r = null, o = null) {
        return new Se(t, e, n, s, i, r, o);
    }

    function Ce(t) {
        const e = F(t);
        if (null === e.ht) {
            let t = e.path.canonicalString();
            null !== e.collectionGroup && (t += "|cg:" + e.collectionGroup), t += "|f:", t += e.filters.map((t => {
                return (e = t).field.canonicalString() + e.op.toString() + fe(e.value);
                var e;
            })).join(","), t += "|ob:", t += e.orderBy.map((t => function(t) {
                // TODO(b/29183165): Make this collision robust.
                return t.field.canonicalString() + t.dir;
            }(t))).join(","), ne(e.limit) || (t += "|l:", t += e.limit), e.startAt && (t += "|lb:", 
            t += e.startAt.inclusive ? "b:" : "a:", t += e.startAt.position.map((t => fe(t))).join(",")), 
            e.endAt && (t += "|ub:", t += e.endAt.inclusive ? "a:" : "b:", t += e.endAt.position.map((t => fe(t))).join(",")), 
            e.ht = t;
        }
        return e.ht;
    }

    function xe(t) {
        let e = t.path.canonicalString();
        return null !== t.collectionGroup && (e += " collectionGroup=" + t.collectionGroup), 
        t.filters.length > 0 && (e += `, filters: [${t.filters.map((t => {
        return `${(e = t).field.canonicalString()} ${e.op} ${fe(e.value)}`;
        /** Returns a debug description for `filter`. */
        var e;
        /** Filter that matches on key fields (i.e. '__name__'). */    })).join(", ")}]`), 
        ne(t.limit) || (e += ", limit: " + t.limit), t.orderBy.length > 0 && (e += `, orderBy: [${t.orderBy.map((t => function(t) {
        return `${t.field.canonicalString()} (${t.dir})`;
    }(t))).join(", ")}]`), t.startAt && (e += ", startAt: ", e += t.startAt.inclusive ? "b:" : "a:", 
        e += t.startAt.position.map((t => fe(t))).join(",")), t.endAt && (e += ", endAt: ", 
        e += t.endAt.inclusive ? "a:" : "b:", e += t.endAt.position.map((t => fe(t))).join(",")), 
        `Target(${e})`;
    }

    function Ne(t, e) {
        if (t.limit !== e.limit) return !1;
        if (t.orderBy.length !== e.orderBy.length) return !1;
        for (let n = 0; n < t.orderBy.length; n++) if (!He(t.orderBy[n], e.orderBy[n])) return !1;
        if (t.filters.length !== e.filters.length) return !1;
        for (let i = 0; i < t.filters.length; i++) if (n = t.filters[i], s = e.filters[i], 
        n.op !== s.op || !n.field.isEqual(s.field) || !ce(n.value, s.value)) return !1;
        var n, s;
        return t.collectionGroup === e.collectionGroup && (!!t.path.isEqual(e.path) && (!!Ye(t.startAt, e.startAt) && Ye(t.endAt, e.endAt)));
    }

    function ke(t) {
        return ut.isDocumentKey(t.path) && null === t.collectionGroup && 0 === t.filters.length;
    }

    /** Returns the number of segments of a perfect index for this target. */ class $e extends class {} {
        constructor(t, e, n) {
            super(), this.field = t, this.op = e, this.value = n;
        }
        /**
         * Creates a filter based on the provided arguments.
         */    static create(t, e, n) {
            return t.isKeyField() ? "in" /* IN */ === e || "not-in" /* NOT_IN */ === e ? this.lt(t, e, n) : new Be(t, e, n) : "array-contains" /* ARRAY_CONTAINS */ === e ? new Ke(t, n) : "in" /* IN */ === e ? new Ge(t, n) : "not-in" /* NOT_IN */ === e ? new Qe(t, n) : "array-contains-any" /* ARRAY_CONTAINS_ANY */ === e ? new je(t, n) : new $e(t, e, n);
        }
        static lt(t, e, n) {
            return "in" /* IN */ === e ? new Le(t, n) : new Ue(t, n);
        }
        matches(t) {
            const e = t.data.field(this.field);
            // Types do not have to match in NOT_EQUAL filters.
                    return "!=" /* NOT_EQUAL */ === this.op ? null !== e && this.ft(he(e, this.value)) : null !== e && ue(this.value) === ue(e) && this.ft(he(e, this.value));
            // Only compare types with matching backend order (such as double and int).
            }
        ft(t) {
            switch (this.op) {
              case "<" /* LESS_THAN */ :
                return t < 0;

              case "<=" /* LESS_THAN_OR_EQUAL */ :
                return t <= 0;

              case "==" /* EQUAL */ :
                return 0 === t;

              case "!=" /* NOT_EQUAL */ :
                return 0 !== t;

              case ">" /* GREATER_THAN */ :
                return t > 0;

              case ">=" /* GREATER_THAN_OR_EQUAL */ :
                return t >= 0;

              default:
                return k();
            }
        }
        dt() {
            return [ "<" /* LESS_THAN */ , "<=" /* LESS_THAN_OR_EQUAL */ , ">" /* GREATER_THAN */ , ">=" /* GREATER_THAN_OR_EQUAL */ , "!=" /* NOT_EQUAL */ , "not-in" /* NOT_IN */ ].indexOf(this.op) >= 0;
        }
    }

    class Be extends $e {
        constructor(t, e, n) {
            super(t, e, n), this.key = ut.fromName(n.referenceValue);
        }
        matches(t) {
            const e = ut.comparator(t.key, this.key);
            return this.ft(e);
        }
    }

    /** Filter that matches on key fields within an array. */ class Le extends $e {
        constructor(t, e) {
            super(t, "in" /* IN */ , e), this.keys = qe("in" /* IN */ , e);
        }
        matches(t) {
            return this.keys.some((e => e.isEqual(t.key)));
        }
    }

    /** Filter that matches on key fields not present within an array. */ class Ue extends $e {
        constructor(t, e) {
            super(t, "not-in" /* NOT_IN */ , e), this.keys = qe("not-in" /* NOT_IN */ , e);
        }
        matches(t) {
            return !this.keys.some((e => e.isEqual(t.key)));
        }
    }

    function qe(t, e) {
        var n;
        return ((null === (n = e.arrayValue) || void 0 === n ? void 0 : n.values) || []).map((t => ut.fromName(t.referenceValue)));
    }

    /** A Filter that implements the array-contains operator. */ class Ke extends $e {
        constructor(t, e) {
            super(t, "array-contains" /* ARRAY_CONTAINS */ , e);
        }
        matches(t) {
            const e = t.data.field(this.field);
            return me(e) && ae(e.arrayValue, this.value);
        }
    }

    /** A Filter that implements the IN operator. */ class Ge extends $e {
        constructor(t, e) {
            super(t, "in" /* IN */ , e);
        }
        matches(t) {
            const e = t.data.field(this.field);
            return null !== e && ae(this.value.arrayValue, e);
        }
    }

    /** A Filter that implements the not-in operator. */ class Qe extends $e {
        constructor(t, e) {
            super(t, "not-in" /* NOT_IN */ , e);
        }
        matches(t) {
            if (ae(this.value.arrayValue, {
                nullValue: "NULL_VALUE"
            })) return !1;
            const e = t.data.field(this.field);
            return null !== e && !ae(this.value.arrayValue, e);
        }
    }

    /** A Filter that implements the array-contains-any operator. */ class je extends $e {
        constructor(t, e) {
            super(t, "array-contains-any" /* ARRAY_CONTAINS_ANY */ , e);
        }
        matches(t) {
            const e = t.data.field(this.field);
            return !(!me(e) || !e.arrayValue.values) && e.arrayValue.values.some((t => ae(this.value.arrayValue, t)));
        }
    }

    /**
     * Represents a bound of a query.
     *
     * The bound is specified with the given components representing a position and
     * whether it's just before or just after the position (relative to whatever the
     * query order is).
     *
     * The position represents a logical index position for a query. It's a prefix
     * of values for the (potentially implicit) order by clauses of a query.
     *
     * Bound provides a function to determine whether a document comes before or
     * after a bound. This is influenced by whether the position is just before or
     * just after the provided values.
     */ class We {
        constructor(t, e) {
            this.position = t, this.inclusive = e;
        }
    }

    /**
     * An ordering on a field, in some Direction. Direction defaults to ASCENDING.
     */ class ze {
        constructor(t, e = "asc" /* ASCENDING */) {
            this.field = t, this.dir = e;
        }
    }

    function He(t, e) {
        return t.dir === e.dir && t.field.isEqual(e.field);
    }

    function Je(t, e, n) {
        let s = 0;
        for (let i = 0; i < t.position.length; i++) {
            const r = e[i], o = t.position[i];
            if (r.field.isKeyField()) s = ut.comparator(ut.fromName(o.referenceValue), n.key); else {
                s = he(o, n.data.field(r.field));
            }
            if ("desc" /* DESCENDING */ === r.dir && (s *= -1), 0 !== s) break;
        }
        return s;
    }

    /**
     * Returns true if a document sorts after a bound using the provided sort
     * order.
     */ function Ye(t, e) {
        if (null === t) return null === e;
        if (null === e) return !1;
        if (t.inclusive !== e.inclusive || t.position.length !== e.position.length) return !1;
        for (let n = 0; n < t.position.length; n++) {
            if (!ce(t.position[n], e.position[n])) return !1;
        }
        return !0;
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Query encapsulates all the query attributes we support in the SDK. It can
     * be run against the LocalStore, as well as be converted to a `Target` to
     * query the RemoteStore results.
     *
     * Visible for testing.
     */ class Xe {
        /**
         * Initializes a Query with a path and optional additional query constraints.
         * Path must currently be empty if this is a collection group query.
         */
        constructor(t, e = null, n = [], s = [], i = null, r = "F" /* First */ , o = null, u = null) {
            this.path = t, this.collectionGroup = e, this.explicitOrderBy = n, this.filters = s, 
            this.limit = i, this.limitType = r, this.startAt = o, this.endAt = u, this._t = null, 
            // The corresponding `Target` of this `Query` instance.
            this.wt = null, this.startAt, this.endAt;
        }
    }

    /** Creates a new Query instance with the options provided. */ function Ze(t, e, n, s, i, r, o, u) {
        return new Xe(t, e, n, s, i, r, o, u);
    }

    /** Creates a new Query for a query that matches all documents at `path` */ function tn(t) {
        return new Xe(t);
    }

    /**
     * Helper to convert a collection group query into a collection query at a
     * specific path. This is used when executing collection group queries, since
     * we have to split the query into a set of collection queries at multiple
     * paths.
     */
    /**
     * Returns true if this query does not specify any query constraints that
     * could remove results.
     */
    function en(t) {
        return 0 === t.filters.length && null === t.limit && null == t.startAt && null == t.endAt && (0 === t.explicitOrderBy.length || 1 === t.explicitOrderBy.length && t.explicitOrderBy[0].field.isKeyField());
    }

    function nn(t) {
        return t.explicitOrderBy.length > 0 ? t.explicitOrderBy[0].field : null;
    }

    function sn(t) {
        for (const e of t.filters) if (e.dt()) return e.field;
        return null;
    }

    /**
     * Checks if any of the provided Operators are included in the query and
     * returns the first one that is, or null if none are.
     */
    /**
     * Returns whether the query matches a collection group rather than a specific
     * collection.
     */
    function rn(t) {
        return null !== t.collectionGroup;
    }

    /**
     * Returns the implicit order by constraint that is used to execute the Query,
     * which can be different from the order by constraints the user provided (e.g.
     * the SDK and backend always orders by `__name__`).
     */ function on(t) {
        const e = F(t);
        if (null === e._t) {
            e._t = [];
            const t = sn(e), n = nn(e);
            if (null !== t && null === n) 
            // In order to implicitly add key ordering, we must also add the
            // inequality filter field for it to be a valid query.
            // Note that the default inequality field and key ordering is ascending.
            t.isKeyField() || e._t.push(new ze(t)), e._t.push(new ze(ot.keyField(), "asc" /* ASCENDING */)); else {
                let t = !1;
                for (const n of e.explicitOrderBy) e._t.push(n), n.field.isKeyField() && (t = !0);
                if (!t) {
                    // The order of the implicit key ordering always matches the last
                    // explicit order by
                    const t = e.explicitOrderBy.length > 0 ? e.explicitOrderBy[e.explicitOrderBy.length - 1].dir : "asc" /* ASCENDING */;
                    e._t.push(new ze(ot.keyField(), t));
                }
            }
        }
        return e._t;
    }

    /**
     * Converts this `Query` instance to it's corresponding `Target` representation.
     */ function un(t) {
        const e = F(t);
        if (!e.wt) if ("F" /* First */ === e.limitType) e.wt = De(e.path, e.collectionGroup, on(e), e.filters, e.limit, e.startAt, e.endAt); else {
            // Flip the orderBy directions since we want the last results
            const t = [];
            for (const n of on(e)) {
                const e = "desc" /* DESCENDING */ === n.dir ? "asc" /* ASCENDING */ : "desc" /* DESCENDING */;
                t.push(new ze(n.field, e));
            }
            // We need to swap the cursors to match the now-flipped query ordering.
                    const n = e.endAt ? new We(e.endAt.position, e.endAt.inclusive) : null, s = e.startAt ? new We(e.startAt.position, e.startAt.inclusive) : null;
            // Now return as a LimitType.First query.
            e.wt = De(e.path, e.collectionGroup, t, e.filters, e.limit, n, s);
        }
        return e.wt;
    }

    function cn(t, e, n) {
        return new Xe(t.path, t.collectionGroup, t.explicitOrderBy.slice(), t.filters.slice(), e, n, t.startAt, t.endAt);
    }

    function an(t, e) {
        return Ne(un(t), un(e)) && t.limitType === e.limitType;
    }

    // TODO(b/29183165): This is used to get a unique string from a query to, for
    // example, use as a dictionary key, but the implementation is subject to
    // collisions. Make it collision-free.
    function hn(t) {
        return `${Ce(un(t))}|lt:${t.limitType}`;
    }

    function ln(t) {
        return `Query(target=${xe(un(t))}; limitType=${t.limitType})`;
    }

    /** Returns whether `doc` matches the constraints of `query`. */ function fn(t, e) {
        return e.isFoundDocument() && function(t, e) {
            const n = e.key.path;
            return null !== t.collectionGroup ? e.key.hasCollectionId(t.collectionGroup) && t.path.isPrefixOf(n) : ut.isDocumentKey(t.path) ? t.path.isEqual(n) : t.path.isImmediateParentOf(n);
        }
        /**
     * A document must have a value for every ordering clause in order to show up
     * in the results.
     */ (t, e) && function(t, e) {
            for (const n of t.explicitOrderBy) 
            // order by key always matches
            if (!n.field.isKeyField() && null === e.data.field(n.field)) return !1;
            return !0;
        }(t, e) && function(t, e) {
            for (const n of t.filters) if (!n.matches(e)) return !1;
            return !0;
        }
        /** Makes sure a document is within the bounds, if provided. */ (t, e) && function(t, e) {
            if (t.startAt && !
            /**
     * Returns true if a document sorts before a bound using the provided sort
     * order.
     */
            function(t, e, n) {
                const s = Je(t, e, n);
                return t.inclusive ? s <= 0 : s < 0;
            }(t.startAt, on(t), e)) return !1;
            if (t.endAt && !function(t, e, n) {
                const s = Je(t, e, n);
                return t.inclusive ? s >= 0 : s > 0;
            }(t.endAt, on(t), e)) return !1;
            return !0;
        }
        /**
     * Returns the collection group that this query targets.
     *
     * PORTING NOTE: This is only used in the Web SDK to facilitate multi-tab
     * synchronization for query results.
     */ (t, e);
    }

    function dn(t) {
        return t.collectionGroup || (t.path.length % 2 == 1 ? t.path.lastSegment() : t.path.get(t.path.length - 2));
    }

    /**
     * Returns a new comparator function that can be used to compare two documents
     * based on the Query's ordering constraint.
     */ function _n(t) {
        return (e, n) => {
            let s = !1;
            for (const i of on(t)) {
                const t = wn(i, e, n);
                if (0 !== t) return t;
                s = s || i.field.isKeyField();
            }
            return 0;
        };
    }

    function wn(t, e, n) {
        const s = t.field.isKeyField() ? ut.comparator(e.key, n.key) : function(t, e, n) {
            const s = e.data.field(t), i = n.data.field(t);
            return null !== s && null !== i ? he(s, i) : k();
        }(t.field, e, n);
        switch (t.dir) {
          case "asc" /* ASCENDING */ :
            return s;

          case "desc" /* DESCENDING */ :
            return -1 * s;

          default:
            return k();
        }
    }

    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Returns an DoubleValue for `value` that is encoded based the serializer's
     * `useProto3Json` setting.
     */ function mn(t, e) {
        if (t.gt) {
            if (isNaN(e)) return {
                doubleValue: "NaN"
            };
            if (e === 1 / 0) return {
                doubleValue: "Infinity"
            };
            if (e === -1 / 0) return {
                doubleValue: "-Infinity"
            };
        }
        return {
            doubleValue: se(e) ? "-0" : e
        };
    }

    /**
     * Returns an IntegerValue for `value`.
     */ function gn(t) {
        return {
            integerValue: "" + t
        };
    }

    /**
     * Returns a value for a number that's appropriate to put into a proto.
     * The return value is an IntegerValue if it can safely represent the value,
     * otherwise a DoubleValue is returned.
     */ function yn(t, e) {
        return ie(e) ? gn(e) : mn(t, e);
    }

    /**
     * @license
     * Copyright 2018 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /** Used to represent a field transform on a mutation. */ class pn {
        constructor() {
            // Make sure that the structural type of `TransformOperation` is unique.
            // See https://github.com/microsoft/TypeScript/issues/5451
            this._ = void 0;
        }
    }

    /**
     * Computes the local transform result against the provided `previousValue`,
     * optionally using the provided localWriteTime.
     */ function In(t, e, n) {
        return t instanceof An ? function(t, e) {
            const n = {
                fields: {
                    __type__: {
                        stringValue: "server_timestamp"
                    },
                    __local_write_time__: {
                        timestampValue: {
                            seconds: t.seconds,
                            nanos: t.nanoseconds
                        }
                    }
                }
            };
            return e && (n.fields.__previous_value__ = e), {
                mapValue: n
            };
        }(n, e) : t instanceof Rn ? bn(t, e) : t instanceof Pn ? vn(t, e) : function(t, e) {
            // PORTING NOTE: Since JavaScript's integer arithmetic is limited to 53 bit
            // precision and resolves overflows by reducing precision, we do not
            // manually cap overflows at 2^63.
            const n = En(t, e), s = Sn(n) + Sn(t.yt);
            return we(n) && we(t.yt) ? gn(s) : mn(t.It, s);
        }(t, e);
    }

    /**
     * Computes a final transform result after the transform has been acknowledged
     * by the server, potentially using the server-provided transformResult.
     */ function Tn(t, e, n) {
        // The server just sends null as the transform result for array operations,
        // so we have to calculate a result the same as we do for local
        // applications.
        return t instanceof Rn ? bn(t, e) : t instanceof Pn ? vn(t, e) : n;
    }

    /**
     * If this transform operation is not idempotent, returns the base value to
     * persist for this transform. If a base value is returned, the transform
     * operation is always applied to this base value, even if document has
     * already been updated.
     *
     * Base values provide consistent behavior for non-idempotent transforms and
     * allow us to return the same latency-compensated value even if the backend
     * has already applied the transform operation. The base value is null for
     * idempotent transforms, as they can be re-played even if the backend has
     * already applied them.
     *
     * @returns a base value to store along with the mutation, or null for
     * idempotent transforms.
     */ function En(t, e) {
        return t instanceof Vn ? we(n = e) || function(t) {
            return !!t && "doubleValue" in t;
        }
        /** Returns true if `value` is either an IntegerValue or a DoubleValue. */ (n) ? e : {
            integerValue: 0
        } : null;
        var n;
    }

    /** Transforms a value into a server-generated timestamp. */
    class An extends pn {}

    /** Transforms an array value via a union operation. */ class Rn extends pn {
        constructor(t) {
            super(), this.elements = t;
        }
    }

    function bn(t, e) {
        const n = Dn(e);
        for (const e of t.elements) n.some((t => ce(t, e))) || n.push(e);
        return {
            arrayValue: {
                values: n
            }
        };
    }

    /** Transforms an array value via a remove operation. */ class Pn extends pn {
        constructor(t) {
            super(), this.elements = t;
        }
    }

    function vn(t, e) {
        let n = Dn(e);
        for (const e of t.elements) n = n.filter((t => !ce(t, e)));
        return {
            arrayValue: {
                values: n
            }
        };
    }

    /**
     * Implements the backend semantics for locally computed NUMERIC_ADD (increment)
     * transforms. Converts all field values to integers or doubles, but unlike the
     * backend does not cap integer values at 2^63. Instead, JavaScript number
     * arithmetic is used and precision loss can occur for values greater than 2^53.
     */ class Vn extends pn {
        constructor(t, e) {
            super(), this.It = t, this.yt = e;
        }
    }

    function Sn(t) {
        return Ht(t.integerValue || t.doubleValue);
    }

    function Dn(t) {
        return me(t) && t.arrayValue.values ? t.arrayValue.values.slice() : [];
    }

    function xn(t, e) {
        return t.field.isEqual(e.field) && function(t, e) {
            return t instanceof Rn && e instanceof Rn || t instanceof Pn && e instanceof Pn ? Z(t.elements, e.elements, ce) : t instanceof Vn && e instanceof Vn ? ce(t.yt, e.yt) : t instanceof An && e instanceof An;
        }(t.transform, e.transform);
    }

    /** The result of successfully applying a mutation to the backend. */
    class Nn {
        constructor(
        /**
         * The version at which the mutation was committed:
         *
         * - For most operations, this is the updateTime in the WriteResult.
         * - For deletes, the commitTime of the WriteResponse (because deletes are
         *   not stored and have no updateTime).
         *
         * Note that these versions can be different: No-op writes will not change
         * the updateTime even though the commitTime advances.
         */
        t, 
        /**
         * The resulting fields returned from the backend after a mutation
         * containing field transforms has been committed. Contains one FieldValue
         * for each FieldTransform that was in the mutation.
         *
         * Will be empty if the mutation did not contain any field transforms.
         */
        e) {
            this.version = t, this.transformResults = e;
        }
    }

    /**
     * Encodes a precondition for a mutation. This follows the model that the
     * backend accepts with the special case of an explicit "empty" precondition
     * (meaning no precondition).
     */ class kn {
        constructor(t, e) {
            this.updateTime = t, this.exists = e;
        }
        /** Creates a new empty Precondition. */    static none() {
            return new kn;
        }
        /** Creates a new Precondition with an exists flag. */    static exists(t) {
            return new kn(void 0, t);
        }
        /** Creates a new Precondition based on a version a document exists at. */    static updateTime(t) {
            return new kn(t);
        }
        /** Returns whether this Precondition is empty. */    get isNone() {
            return void 0 === this.updateTime && void 0 === this.exists;
        }
        isEqual(t) {
            return this.exists === t.exists && (this.updateTime ? !!t.updateTime && this.updateTime.isEqual(t.updateTime) : !t.updateTime);
        }
    }

    /** Returns true if the preconditions is valid for the given document. */ function Mn(t, e) {
        return void 0 !== t.updateTime ? e.isFoundDocument() && e.version.isEqual(t.updateTime) : void 0 === t.exists || t.exists === e.isFoundDocument();
    }

    /**
     * A mutation describes a self-contained change to a document. Mutations can
     * create, replace, delete, and update subsets of documents.
     *
     * Mutations not only act on the value of the document but also its version.
     *
     * For local mutations (mutations that haven't been committed yet), we preserve
     * the existing version for Set and Patch mutations. For Delete mutations, we
     * reset the version to 0.
     *
     * Here's the expected transition table.
     *
     * MUTATION           APPLIED TO            RESULTS IN
     *
     * SetMutation        Document(v3)          Document(v3)
     * SetMutation        NoDocument(v3)        Document(v0)
     * SetMutation        InvalidDocument(v0)   Document(v0)
     * PatchMutation      Document(v3)          Document(v3)
     * PatchMutation      NoDocument(v3)        NoDocument(v3)
     * PatchMutation      InvalidDocument(v0)   UnknownDocument(v3)
     * DeleteMutation     Document(v3)          NoDocument(v0)
     * DeleteMutation     NoDocument(v3)        NoDocument(v0)
     * DeleteMutation     InvalidDocument(v0)   NoDocument(v0)
     *
     * For acknowledged mutations, we use the updateTime of the WriteResponse as
     * the resulting version for Set and Patch mutations. As deletes have no
     * explicit update time, we use the commitTime of the WriteResponse for
     * Delete mutations.
     *
     * If a mutation is acknowledged by the backend but fails the precondition check
     * locally, we transition to an `UnknownDocument` and rely on Watch to send us
     * the updated version.
     *
     * Field transforms are used only with Patch and Set Mutations. We use the
     * `updateTransforms` message to store transforms, rather than the `transforms`s
     * messages.
     *
     * ## Subclassing Notes
     *
     * Every type of mutation needs to implement its own applyToRemoteDocument() and
     * applyToLocalView() to implement the actual behavior of applying the mutation
     * to some source document (see `setMutationApplyToRemoteDocument()` for an
     * example).
     */ class On {}

    /**
     * A utility method to calculate a `Mutation` representing the overlay from the
     * final state of the document, and a `FieldMask` representing the fields that
     * are mutated by the local mutations.
     */ function Fn(t, e) {
        if (!t.hasLocalMutations || e && 0 === e.fields.length) return null;
        // mask is null when sets or deletes are applied to the current document.
            if (null === e) return t.isNoDocument() ? new Wn(t.key, kn.none()) : new qn(t.key, t.data, kn.none());
        {
            const n = t.data, s = Pe.empty();
            let i = new Ut(ot.comparator);
            for (let t of e.fields) if (!i.has(t)) {
                let e = n.field(t);
                // If we are deleting a nested field, we take the immediate parent as
                // the mask used to construct the resulting mutation.
                // Justification: Nested fields can create parent fields implicitly. If
                // only a leaf entry is deleted in later mutations, the parent field
                // should still remain, but we may have lost this information.
                // Consider mutation (foo.bar 1), then mutation (foo.bar delete()).
                // This leaves the final result (foo, {}). Despite the fact that `doc`
                // has the correct result, `foo` is not in `mask`, and the resulting
                // mutation would miss `foo`.
                            null === e && t.length > 1 && (t = t.popLast(), e = n.field(t)), null === e ? s.delete(t) : s.set(t, e), 
                i = i.add(t);
            }
            return new Kn(t.key, s, new Gt(i.toArray()), kn.none());
        }
    }

    /**
     * Applies this mutation to the given document for the purposes of computing a
     * new remote document. If the input document doesn't match the expected state
     * (e.g. it is invalid or outdated), the document type may transition to
     * unknown.
     *
     * @param mutation - The mutation to apply.
     * @param document - The document to mutate. The input document can be an
     *     invalid document if the client has no knowledge of the pre-mutation state
     *     of the document.
     * @param mutationResult - The result of applying the mutation from the backend.
     */ function $n(t, e, n) {
        t instanceof qn ? function(t, e, n) {
            // Unlike setMutationApplyToLocalView, if we're applying a mutation to a
            // remote document the server has accepted the mutation so the precondition
            // must have held.
            const s = t.value.clone(), i = Qn(t.fieldTransforms, e, n.transformResults);
            s.setAll(i), e.convertToFoundDocument(n.version, s).setHasCommittedMutations();
        }(t, e, n) : t instanceof Kn ? function(t, e, n) {
            if (!Mn(t.precondition, e)) 
            // Since the mutation was not rejected, we know that the precondition
            // matched on the backend. We therefore must not have the expected version
            // of the document in our cache and convert to an UnknownDocument with a
            // known updateTime.
            return void e.convertToUnknownDocument(n.version);
            const s = Qn(t.fieldTransforms, e, n.transformResults), i = e.data;
            i.setAll(Gn(t)), i.setAll(s), e.convertToFoundDocument(n.version, i).setHasCommittedMutations();
        }(t, e, n) : function(t, e, n) {
            // Unlike applyToLocalView, if we're applying a mutation to a remote
            // document the server has accepted the mutation so the precondition must
            // have held.
            e.convertToNoDocument(n.version).setHasCommittedMutations();
        }(0, e, n);
    }

    /**
     * Applies this mutation to the given document for the purposes of computing
     * the new local view of a document. If the input document doesn't match the
     * expected state, the document is not modified.
     *
     * @param mutation - The mutation to apply.
     * @param document - The document to mutate. The input document can be an
     *     invalid document if the client has no knowledge of the pre-mutation state
     *     of the document.
     * @param previousMask - The fields that have been updated before applying this mutation.
     * @param localWriteTime - A timestamp indicating the local write time of the
     *     batch this mutation is a part of.
     * @returns A `FieldMask` representing the fields that are changed by applying this mutation.
     */ function Bn(t, e, n, s) {
        return t instanceof qn ? function(t, e, n, s) {
            if (!Mn(t.precondition, e)) 
            // The mutation failed to apply (e.g. a document ID created with add()
            // caused a name collision).
            return n;
            const i = t.value.clone(), r = jn(t.fieldTransforms, s, e);
            return i.setAll(r), e.convertToFoundDocument(e.version, i).setHasLocalMutations(), 
            null;
     // SetMutation overwrites all fields.
            }
        /**
     * A mutation that modifies fields of the document at the given key with the
     * given values. The values are applied through a field mask:
     *
     *  * When a field is in both the mask and the values, the corresponding field
     *    is updated.
     *  * When a field is in neither the mask nor the values, the corresponding
     *    field is unmodified.
     *  * When a field is in the mask but not in the values, the corresponding field
     *    is deleted.
     *  * When a field is not in the mask but is in the values, the values map is
     *    ignored.
     */ (t, e, n, s) : t instanceof Kn ? function(t, e, n, s) {
            if (!Mn(t.precondition, e)) return n;
            const i = jn(t.fieldTransforms, s, e), r = e.data;
            if (r.setAll(Gn(t)), r.setAll(i), e.convertToFoundDocument(e.version, r).setHasLocalMutations(), 
            null === n) return null;
            return n.unionWith(t.fieldMask.fields).unionWith(t.fieldTransforms.map((t => t.field)));
        }
        /**
     * Returns a FieldPath/Value map with the content of the PatchMutation.
     */ (t, e, n, s) : function(t, e, n) {
            if (Mn(t.precondition, e)) return e.convertToNoDocument(e.version).setHasLocalMutations(), 
            null;
            return n;
        }
        /**
     * A mutation that verifies the existence of the document at the given key with
     * the provided precondition.
     *
     * The `verify` operation is only used in Transactions, and this class serves
     * primarily to facilitate serialization into protos.
     */ (t, e, n);
    }

    /**
     * If this mutation is not idempotent, returns the base value to persist with
     * this mutation. If a base value is returned, the mutation is always applied
     * to this base value, even if document has already been updated.
     *
     * The base value is a sparse object that consists of only the document
     * fields for which this mutation contains a non-idempotent transformation
     * (e.g. a numeric increment). The provided value guarantees consistent
     * behavior for non-idempotent transforms and allow us to return the same
     * latency-compensated value even if the backend has already applied the
     * mutation. The base value is null for idempotent mutations, as they can be
     * re-played even if the backend has already applied them.
     *
     * @returns a base value to store along with the mutation, or null for
     * idempotent mutations.
     */ function Ln(t, e) {
        let n = null;
        for (const s of t.fieldTransforms) {
            const t = e.data.field(s.field), i = En(s.transform, t || null);
            null != i && (null === n && (n = Pe.empty()), n.set(s.field, i));
        }
        return n || null;
    }

    function Un(t, e) {
        return t.type === e.type && (!!t.key.isEqual(e.key) && (!!t.precondition.isEqual(e.precondition) && (!!function(t, e) {
            return void 0 === t && void 0 === e || !(!t || !e) && Z(t, e, ((t, e) => xn(t, e)));
        }(t.fieldTransforms, e.fieldTransforms) && (0 /* Set */ === t.type ? t.value.isEqual(e.value) : 1 /* Patch */ !== t.type || t.data.isEqual(e.data) && t.fieldMask.isEqual(e.fieldMask)))));
    }

    /**
     * A mutation that creates or replaces the document at the given key with the
     * object value contents.
     */ class qn extends On {
        constructor(t, e, n, s = []) {
            super(), this.key = t, this.value = e, this.precondition = n, this.fieldTransforms = s, 
            this.type = 0 /* Set */;
        }
        getFieldMask() {
            return null;
        }
    }

    class Kn extends On {
        constructor(t, e, n, s, i = []) {
            super(), this.key = t, this.data = e, this.fieldMask = n, this.precondition = s, 
            this.fieldTransforms = i, this.type = 1 /* Patch */;
        }
        getFieldMask() {
            return this.fieldMask;
        }
    }

    function Gn(t) {
        const e = new Map;
        return t.fieldMask.fields.forEach((n => {
            if (!n.isEmpty()) {
                const s = t.data.field(n);
                e.set(n, s);
            }
        })), e;
    }

    /**
     * Creates a list of "transform results" (a transform result is a field value
     * representing the result of applying a transform) for use after a mutation
     * containing transforms has been acknowledged by the server.
     *
     * @param fieldTransforms - The field transforms to apply the result to.
     * @param mutableDocument - The current state of the document after applying all
     * previous mutations.
     * @param serverTransformResults - The transform results received by the server.
     * @returns The transform results list.
     */ function Qn(t, e, n) {
        const s = new Map;
        M(t.length === n.length);
        for (let i = 0; i < n.length; i++) {
            const r = t[i], o = r.transform, u = e.data.field(r.field);
            s.set(r.field, Tn(o, u, n[i]));
        }
        return s;
    }

    /**
     * Creates a list of "transform results" (a transform result is a field value
     * representing the result of applying a transform) for use when applying a
     * transform locally.
     *
     * @param fieldTransforms - The field transforms to apply the result to.
     * @param localWriteTime - The local time of the mutation (used to
     *     generate ServerTimestampValues).
     * @param mutableDocument - The document to apply transforms on.
     * @returns The transform results list.
     */ function jn(t, e, n) {
        const s = new Map;
        for (const i of t) {
            const t = i.transform, r = n.data.field(i.field);
            s.set(i.field, In(t, r, e));
        }
        return s;
    }

    /** A mutation that deletes the document at the given key. */ class Wn extends On {
        constructor(t, e) {
            super(), this.key = t, this.precondition = e, this.type = 2 /* Delete */ , this.fieldTransforms = [];
        }
        getFieldMask() {
            return null;
        }
    }

    class zn extends On {
        constructor(t, e) {
            super(), this.key = t, this.precondition = e, this.type = 3 /* Verify */ , this.fieldTransforms = [];
        }
        getFieldMask() {
            return null;
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */ class Hn {
        // TODO(b/33078163): just use simplest form of existence filter for now
        constructor(t) {
            this.count = t;
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Error Codes describing the different ways GRPC can fail. These are copied
     * directly from GRPC's sources here:
     *
     * https://github.com/grpc/grpc/blob/bceec94ea4fc5f0085d81235d8e1c06798dc341a/include/grpc%2B%2B/impl/codegen/status_code_enum.h
     *
     * Important! The names of these identifiers matter because the string forms
     * are used for reverse lookups from the webchannel stream. Do NOT change the
     * names of these identifiers or change this into a const enum.
     */ var Jn, Yn;

    /**
     * Determines whether an error code represents a permanent error when received
     * in response to a non-write operation.
     *
     * See isPermanentWriteError for classifying write errors.
     */
    function Xn(t) {
        switch (t) {
          default:
            return k();

          case $.CANCELLED:
          case $.UNKNOWN:
          case $.DEADLINE_EXCEEDED:
          case $.RESOURCE_EXHAUSTED:
          case $.INTERNAL:
          case $.UNAVAILABLE:
     // Unauthenticated means something went wrong with our token and we need
            // to retry with new credentials which will happen automatically.
                  case $.UNAUTHENTICATED:
            return !1;

          case $.INVALID_ARGUMENT:
          case $.NOT_FOUND:
          case $.ALREADY_EXISTS:
          case $.PERMISSION_DENIED:
          case $.FAILED_PRECONDITION:
     // Aborted might be retried in some scenarios, but that is dependant on
            // the context and should handled individually by the calling code.
            // See https://cloud.google.com/apis/design/errors.
                  case $.ABORTED:
          case $.OUT_OF_RANGE:
          case $.UNIMPLEMENTED:
          case $.DATA_LOSS:
            return !0;
        }
    }

    /**
     * Determines whether an error code represents a permanent error when received
     * in response to a write operation.
     *
     * Write operations must be handled specially because as of b/119437764, ABORTED
     * errors on the write stream should be retried too (even though ABORTED errors
     * are not generally retryable).
     *
     * Note that during the initial handshake on the write stream an ABORTED error
     * signals that we should discard our stream token (i.e. it is permanent). This
     * means a handshake error should be classified with isPermanentError, above.
     */
    /**
     * Maps an error Code from GRPC status code number, like 0, 1, or 14. These
     * are not the same as HTTP status codes.
     *
     * @returns The Code equivalent to the given GRPC status code. Fails if there
     *     is no match.
     */
    function Zn(t) {
        if (void 0 === t) 
        // This shouldn't normally happen, but in certain error cases (like trying
        // to send invalid proto messages) we may get an error with no GRPC code.
        return C("GRPC error has no .code"), $.UNKNOWN;
        switch (t) {
          case Jn.OK:
            return $.OK;

          case Jn.CANCELLED:
            return $.CANCELLED;

          case Jn.UNKNOWN:
            return $.UNKNOWN;

          case Jn.DEADLINE_EXCEEDED:
            return $.DEADLINE_EXCEEDED;

          case Jn.RESOURCE_EXHAUSTED:
            return $.RESOURCE_EXHAUSTED;

          case Jn.INTERNAL:
            return $.INTERNAL;

          case Jn.UNAVAILABLE:
            return $.UNAVAILABLE;

          case Jn.UNAUTHENTICATED:
            return $.UNAUTHENTICATED;

          case Jn.INVALID_ARGUMENT:
            return $.INVALID_ARGUMENT;

          case Jn.NOT_FOUND:
            return $.NOT_FOUND;

          case Jn.ALREADY_EXISTS:
            return $.ALREADY_EXISTS;

          case Jn.PERMISSION_DENIED:
            return $.PERMISSION_DENIED;

          case Jn.FAILED_PRECONDITION:
            return $.FAILED_PRECONDITION;

          case Jn.ABORTED:
            return $.ABORTED;

          case Jn.OUT_OF_RANGE:
            return $.OUT_OF_RANGE;

          case Jn.UNIMPLEMENTED:
            return $.UNIMPLEMENTED;

          case Jn.DATA_LOSS:
            return $.DATA_LOSS;

          default:
            return k();
        }
    }

    /**
     * Converts an HTTP response's error status to the equivalent error code.
     *
     * @param status - An HTTP error response status ("FAILED_PRECONDITION",
     * "UNKNOWN", etc.)
     * @returns The equivalent Code. Non-matching responses are mapped to
     *     Code.UNKNOWN.
     */ (Yn = Jn || (Jn = {}))[Yn.OK = 0] = "OK", Yn[Yn.CANCELLED = 1] = "CANCELLED", 
    Yn[Yn.UNKNOWN = 2] = "UNKNOWN", Yn[Yn.INVALID_ARGUMENT = 3] = "INVALID_ARGUMENT", 
    Yn[Yn.DEADLINE_EXCEEDED = 4] = "DEADLINE_EXCEEDED", Yn[Yn.NOT_FOUND = 5] = "NOT_FOUND", 
    Yn[Yn.ALREADY_EXISTS = 6] = "ALREADY_EXISTS", Yn[Yn.PERMISSION_DENIED = 7] = "PERMISSION_DENIED", 
    Yn[Yn.UNAUTHENTICATED = 16] = "UNAUTHENTICATED", Yn[Yn.RESOURCE_EXHAUSTED = 8] = "RESOURCE_EXHAUSTED", 
    Yn[Yn.FAILED_PRECONDITION = 9] = "FAILED_PRECONDITION", Yn[Yn.ABORTED = 10] = "ABORTED", 
    Yn[Yn.OUT_OF_RANGE = 11] = "OUT_OF_RANGE", Yn[Yn.UNIMPLEMENTED = 12] = "UNIMPLEMENTED", 
    Yn[Yn.INTERNAL = 13] = "INTERNAL", Yn[Yn.UNAVAILABLE = 14] = "UNAVAILABLE", Yn[Yn.DATA_LOSS = 15] = "DATA_LOSS";

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * A map implementation that uses objects as keys. Objects must have an
     * associated equals function and must be immutable. Entries in the map are
     * stored together with the key being produced from the mapKeyFn. This map
     * automatically handles collisions of keys.
     */
    class ts {
        constructor(t, e) {
            this.mapKeyFn = t, this.equalsFn = e, 
            /**
             * The inner map for a key/value pair. Due to the possibility of collisions we
             * keep a list of entries that we do a linear search through to find an actual
             * match. Note that collisions should be rare, so we still expect near
             * constant time lookups in practice.
             */
            this.inner = {}, 
            /** The number of entries stored in the map */
            this.innerSize = 0;
        }
        /** Get a value for this key, or undefined if it does not exist. */    get(t) {
            const e = this.mapKeyFn(t), n = this.inner[e];
            if (void 0 !== n) for (const [e, s] of n) if (this.equalsFn(e, t)) return s;
        }
        has(t) {
            return void 0 !== this.get(t);
        }
        /** Put this key and value in the map. */    set(t, e) {
            const n = this.mapKeyFn(t), s = this.inner[n];
            if (void 0 === s) return this.inner[n] = [ [ t, e ] ], void this.innerSize++;
            for (let n = 0; n < s.length; n++) if (this.equalsFn(s[n][0], t)) 
            // This is updating an existing entry and does not increase `innerSize`.
            return void (s[n] = [ t, e ]);
            s.push([ t, e ]), this.innerSize++;
        }
        /**
         * Remove this key from the map. Returns a boolean if anything was deleted.
         */    delete(t) {
            const e = this.mapKeyFn(t), n = this.inner[e];
            if (void 0 === n) return !1;
            for (let s = 0; s < n.length; s++) if (this.equalsFn(n[s][0], t)) return 1 === n.length ? delete this.inner[e] : n.splice(s, 1), 
            this.innerSize--, !0;
            return !1;
        }
        forEach(t) {
            Ot(this.inner, ((e, n) => {
                for (const [e, s] of n) t(e, s);
            }));
        }
        isEmpty() {
            return Ft(this.inner);
        }
        size() {
            return this.innerSize;
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */ const es = new $t(ut.comparator);

    function ns() {
        return es;
    }

    const ss = new $t(ut.comparator);

    function is(...t) {
        let e = ss;
        for (const n of t) e = e.insert(n.key, n);
        return e;
    }

    function rs(t) {
        let e = ss;
        return t.forEach(((t, n) => e = e.insert(t, n.overlayedDocument))), e;
    }

    function os() {
        return cs();
    }

    function us() {
        return cs();
    }

    function cs() {
        return new ts((t => t.toString()), ((t, e) => t.isEqual(e)));
    }

    const as = new $t(ut.comparator);

    const hs = new Ut(ut.comparator);

    function ls(...t) {
        let e = hs;
        for (const n of t) e = e.add(n);
        return e;
    }

    const fs = new Ut(X);

    function ds() {
        return fs;
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * An event from the RemoteStore. It is split into targetChanges (changes to the
     * state or the set of documents in our watched targets) and documentUpdates
     * (changes to the actual documents).
     */ class _s {
        constructor(
        /**
         * The snapshot version this event brings us up to, or MIN if not set.
         */
        t, 
        /**
         * A map from target to changes to the target. See TargetChange.
         */
        e, 
        /**
         * A set of targets that is known to be inconsistent. Listens for these
         * targets should be re-established without resume tokens.
         */
        n, 
        /**
         * A set of which documents have changed or been deleted, along with the
         * doc's new values (if not deleted).
         */
        s, 
        /**
         * A set of which document updates are due only to limbo resolution targets.
         */
        i) {
            this.snapshotVersion = t, this.targetChanges = e, this.targetMismatches = n, this.documentUpdates = s, 
            this.resolvedLimboDocuments = i;
        }
        /**
         * HACK: Views require RemoteEvents in order to determine whether the view is
         * CURRENT, but secondary tabs don't receive remote events. So this method is
         * used to create a synthesized RemoteEvent that can be used to apply a
         * CURRENT status change to a View, for queries executed in a different tab.
         */
        // PORTING NOTE: Multi-tab only
        static createSynthesizedRemoteEventForCurrentChange(t, e) {
            const n = new Map;
            return n.set(t, ws.createSynthesizedTargetChangeForCurrentChange(t, e)), new _s(nt.min(), n, ds(), ns(), ls());
        }
    }

    /**
     * A TargetChange specifies the set of changes for a specific target as part of
     * a RemoteEvent. These changes track which documents are added, modified or
     * removed, as well as the target's resume token and whether the target is
     * marked CURRENT.
     * The actual changes *to* documents are not part of the TargetChange since
     * documents may be part of multiple targets.
     */ class ws {
        constructor(
        /**
         * An opaque, server-assigned token that allows watching a query to be resumed
         * after disconnecting without retransmitting all the data that matches the
         * query. The resume token essentially identifies a point in time from which
         * the server should resume sending results.
         */
        t, 
        /**
         * The "current" (synced) status of this target. Note that "current"
         * has special meaning in the RPC protocol that implies that a target is
         * both up-to-date and consistent with the rest of the watch stream.
         */
        e, 
        /**
         * The set of documents that were newly assigned to this target as part of
         * this remote event.
         */
        n, 
        /**
         * The set of documents that were already assigned to this target but received
         * an update during this remote event.
         */
        s, 
        /**
         * The set of documents that were removed from this target as part of this
         * remote event.
         */
        i) {
            this.resumeToken = t, this.current = e, this.addedDocuments = n, this.modifiedDocuments = s, 
            this.removedDocuments = i;
        }
        /**
         * This method is used to create a synthesized TargetChanges that can be used to
         * apply a CURRENT status change to a View (for queries executed in a different
         * tab) or for new queries (to raise snapshots with correct CURRENT status).
         */    static createSynthesizedTargetChangeForCurrentChange(t, e) {
            return new ws(jt.EMPTY_BYTE_STRING, e, ls(), ls(), ls());
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Represents a changed document and a list of target ids to which this change
     * applies.
     *
     * If document has been deleted NoDocument will be provided.
     */ class ms {
        constructor(
        /** The new document applies to all of these targets. */
        t, 
        /** The new document is removed from all of these targets. */
        e, 
        /** The key of the document for this change. */
        n, 
        /**
         * The new document or NoDocument if it was deleted. Is null if the
         * document went out of view without the server sending a new document.
         */
        s) {
            this.Tt = t, this.removedTargetIds = e, this.key = n, this.Et = s;
        }
    }

    class gs {
        constructor(t, e) {
            this.targetId = t, this.At = e;
        }
    }

    class ys {
        constructor(
        /** What kind of change occurred to the watch target. */
        t, 
        /** The target IDs that were added/removed/set. */
        e, 
        /**
         * An opaque, server-assigned token that allows watching a target to be
         * resumed after disconnecting without retransmitting all the data that
         * matches the target. The resume token essentially identifies a point in
         * time from which the server should resume sending results.
         */
        n = jt.EMPTY_BYTE_STRING
        /** An RPC error indicating why the watch failed. */ , s = null) {
            this.state = t, this.targetIds = e, this.resumeToken = n, this.cause = s;
        }
    }

    /** Tracks the internal state of a Watch target. */ class ps {
        constructor() {
            /**
             * The number of pending responses (adds or removes) that we are waiting on.
             * We only consider targets active that have no pending responses.
             */
            this.Rt = 0, 
            /**
             * Keeps track of the document changes since the last raised snapshot.
             *
             * These changes are continuously updated as we receive document updates and
             * always reflect the current set of changes against the last issued snapshot.
             */
            this.bt = Es(), 
            /** See public getters for explanations of these fields. */
            this.Pt = jt.EMPTY_BYTE_STRING, this.vt = !1, 
            /**
             * Whether this target state should be included in the next snapshot. We
             * initialize to true so that newly-added targets are included in the next
             * RemoteEvent.
             */
            this.Vt = !0;
        }
        /**
         * Whether this target has been marked 'current'.
         *
         * 'Current' has special meaning in the RPC protocol: It implies that the
         * Watch backend has sent us all changes up to the point at which the target
         * was added and that the target is consistent with the rest of the watch
         * stream.
         */    get current() {
            return this.vt;
        }
        /** The last resume token sent to us for this target. */    get resumeToken() {
            return this.Pt;
        }
        /** Whether this target has pending target adds or target removes. */    get St() {
            return 0 !== this.Rt;
        }
        /** Whether we have modified any state that should trigger a snapshot. */    get Dt() {
            return this.Vt;
        }
        /**
         * Applies the resume token to the TargetChange, but only when it has a new
         * value. Empty resumeTokens are discarded.
         */    Ct(t) {
            t.approximateByteSize() > 0 && (this.Vt = !0, this.Pt = t);
        }
        /**
         * Creates a target change from the current set of changes.
         *
         * To reset the document changes after raising this snapshot, call
         * `clearPendingChanges()`.
         */    xt() {
            let t = ls(), e = ls(), n = ls();
            return this.bt.forEach(((s, i) => {
                switch (i) {
                  case 0 /* Added */ :
                    t = t.add(s);
                    break;

                  case 2 /* Modified */ :
                    e = e.add(s);
                    break;

                  case 1 /* Removed */ :
                    n = n.add(s);
                    break;

                  default:
                    k();
                }
            })), new ws(this.Pt, this.vt, t, e, n);
        }
        /**
         * Resets the document changes and sets `hasPendingChanges` to false.
         */    Nt() {
            this.Vt = !1, this.bt = Es();
        }
        kt(t, e) {
            this.Vt = !0, this.bt = this.bt.insert(t, e);
        }
        Mt(t) {
            this.Vt = !0, this.bt = this.bt.remove(t);
        }
        Ot() {
            this.Rt += 1;
        }
        Ft() {
            this.Rt -= 1;
        }
        $t() {
            this.Vt = !0, this.vt = !0;
        }
    }

    /**
     * A helper class to accumulate watch changes into a RemoteEvent.
     */
    class Is {
        constructor(t) {
            this.Bt = t, 
            /** The internal state of all tracked targets. */
            this.Lt = new Map, 
            /** Keeps track of the documents to update since the last raised snapshot. */
            this.Ut = ns(), 
            /** A mapping of document keys to their set of target IDs. */
            this.qt = Ts(), 
            /**
             * A list of targets with existence filter mismatches. These targets are
             * known to be inconsistent and their listens needs to be re-established by
             * RemoteStore.
             */
            this.Kt = new Ut(X);
        }
        /**
         * Processes and adds the DocumentWatchChange to the current set of changes.
         */    Gt(t) {
            for (const e of t.Tt) t.Et && t.Et.isFoundDocument() ? this.Qt(e, t.Et) : this.jt(e, t.key, t.Et);
            for (const e of t.removedTargetIds) this.jt(e, t.key, t.Et);
        }
        /** Processes and adds the WatchTargetChange to the current set of changes. */    Wt(t) {
            this.forEachTarget(t, (e => {
                const n = this.zt(e);
                switch (t.state) {
                  case 0 /* NoChange */ :
                    this.Ht(e) && n.Ct(t.resumeToken);
                    break;

                  case 1 /* Added */ :
                    // We need to decrement the number of pending acks needed from watch
                    // for this targetId.
                    n.Ft(), n.St || 
                    // We have a freshly added target, so we need to reset any state
                    // that we had previously. This can happen e.g. when remove and add
                    // back a target for existence filter mismatches.
                    n.Nt(), n.Ct(t.resumeToken);
                    break;

                  case 2 /* Removed */ :
                    // We need to keep track of removed targets to we can post-filter and
                    // remove any target changes.
                    // We need to decrement the number of pending acks needed from watch
                    // for this targetId.
                    n.Ft(), n.St || this.removeTarget(e);
                    break;

                  case 3 /* Current */ :
                    this.Ht(e) && (n.$t(), n.Ct(t.resumeToken));
                    break;

                  case 4 /* Reset */ :
                    this.Ht(e) && (
                    // Reset the target and synthesizes removes for all existing
                    // documents. The backend will re-add any documents that still
                    // match the target before it sends the next global snapshot.
                    this.Jt(e), n.Ct(t.resumeToken));
                    break;

                  default:
                    k();
                }
            }));
        }
        /**
         * Iterates over all targetIds that the watch change applies to: either the
         * targetIds explicitly listed in the change or the targetIds of all currently
         * active targets.
         */    forEachTarget(t, e) {
            t.targetIds.length > 0 ? t.targetIds.forEach(e) : this.Lt.forEach(((t, n) => {
                this.Ht(n) && e(n);
            }));
        }
        /**
         * Handles existence filters and synthesizes deletes for filter mismatches.
         * Targets that are invalidated by filter mismatches are added to
         * `pendingTargetResets`.
         */    Yt(t) {
            const e = t.targetId, n = t.At.count, s = this.Xt(e);
            if (s) {
                const t = s.target;
                if (ke(t)) if (0 === n) {
                    // The existence filter told us the document does not exist. We deduce
                    // that this document does not exist and apply a deleted document to
                    // our updates. Without applying this deleted document there might be
                    // another query that will raise this document as part of a snapshot
                    // until it is resolved, essentially exposing inconsistency between
                    // queries.
                    const n = new ut(t.path);
                    this.jt(e, n, Ve.newNoDocument(n, nt.min()));
                } else M(1 === n); else {
                    this.Zt(e) !== n && (
                    // Existence filter mismatch: We reset the mapping and raise a new
                    // snapshot with `isFromCache:true`.
                    this.Jt(e), this.Kt = this.Kt.add(e));
                }
            }
        }
        /**
         * Converts the currently accumulated state into a remote event at the
         * provided snapshot version. Resets the accumulated changes before returning.
         */    te(t) {
            const e = new Map;
            this.Lt.forEach(((n, s) => {
                const i = this.Xt(s);
                if (i) {
                    if (n.current && ke(i.target)) {
                        // Document queries for document that don't exist can produce an empty
                        // result set. To update our local cache, we synthesize a document
                        // delete if we have not previously received the document. This
                        // resolves the limbo state of the document, removing it from
                        // limboDocumentRefs.
                        // TODO(dimond): Ideally we would have an explicit lookup target
                        // instead resulting in an explicit delete message and we could
                        // remove this special logic.
                        const e = new ut(i.target.path);
                        null !== this.Ut.get(e) || this.ee(s, e) || this.jt(s, e, Ve.newNoDocument(e, t));
                    }
                    n.Dt && (e.set(s, n.xt()), n.Nt());
                }
            }));
            let n = ls();
            // We extract the set of limbo-only document updates as the GC logic
            // special-cases documents that do not appear in the target cache.
            
            // TODO(gsoltis): Expand on this comment once GC is available in the JS
            // client.
                    this.qt.forEach(((t, e) => {
                let s = !0;
                e.forEachWhile((t => {
                    const e = this.Xt(t);
                    return !e || 2 /* LimboResolution */ === e.purpose || (s = !1, !1);
                })), s && (n = n.add(t));
            })), this.Ut.forEach(((e, n) => n.setReadTime(t)));
            const s = new _s(t, e, this.Kt, this.Ut, n);
            return this.Ut = ns(), this.qt = Ts(), this.Kt = new Ut(X), s;
        }
        /**
         * Adds the provided document to the internal list of document updates and
         * its document key to the given target's mapping.
         */
        // Visible for testing.
        Qt(t, e) {
            if (!this.Ht(t)) return;
            const n = this.ee(t, e.key) ? 2 /* Modified */ : 0 /* Added */;
            this.zt(t).kt(e.key, n), this.Ut = this.Ut.insert(e.key, e), this.qt = this.qt.insert(e.key, this.ne(e.key).add(t));
        }
        /**
         * Removes the provided document from the target mapping. If the
         * document no longer matches the target, but the document's state is still
         * known (e.g. we know that the document was deleted or we received the change
         * that caused the filter mismatch), the new document can be provided
         * to update the remote document cache.
         */
        // Visible for testing.
        jt(t, e, n) {
            if (!this.Ht(t)) return;
            const s = this.zt(t);
            this.ee(t, e) ? s.kt(e, 1 /* Removed */) : 
            // The document may have entered and left the target before we raised a
            // snapshot, so we can just ignore the change.
            s.Mt(e), this.qt = this.qt.insert(e, this.ne(e).delete(t)), n && (this.Ut = this.Ut.insert(e, n));
        }
        removeTarget(t) {
            this.Lt.delete(t);
        }
        /**
         * Returns the current count of documents in the target. This includes both
         * the number of documents that the LocalStore considers to be part of the
         * target as well as any accumulated changes.
         */    Zt(t) {
            const e = this.zt(t).xt();
            return this.Bt.getRemoteKeysForTarget(t).size + e.addedDocuments.size - e.removedDocuments.size;
        }
        /**
         * Increment the number of acks needed from watch before we can consider the
         * server to be 'in-sync' with the client's active targets.
         */    Ot(t) {
            this.zt(t).Ot();
        }
        zt(t) {
            let e = this.Lt.get(t);
            return e || (e = new ps, this.Lt.set(t, e)), e;
        }
        ne(t) {
            let e = this.qt.get(t);
            return e || (e = new Ut(X), this.qt = this.qt.insert(t, e)), e;
        }
        /**
         * Verifies that the user is still interested in this target (by calling
         * `getTargetDataForTarget()`) and that we are not waiting for pending ADDs
         * from watch.
         */    Ht(t) {
            const e = null !== this.Xt(t);
            return e || D("WatchChangeAggregator", "Detected inactive target", t), e;
        }
        /**
         * Returns the TargetData for an active target (i.e. a target that the user
         * is still interested in that has no outstanding target change requests).
         */    Xt(t) {
            const e = this.Lt.get(t);
            return e && e.St ? null : this.Bt.se(t);
        }
        /**
         * Resets the state of a Watch target to its initial state (e.g. sets
         * 'current' to false, clears the resume token and removes its target mapping
         * from all documents).
         */    Jt(t) {
            this.Lt.set(t, new ps);
            this.Bt.getRemoteKeysForTarget(t).forEach((e => {
                this.jt(t, e, /*updatedDocument=*/ null);
            }));
        }
        /**
         * Returns whether the LocalStore considers the document to be part of the
         * specified target.
         */    ee(t, e) {
            return this.Bt.getRemoteKeysForTarget(t).has(e);
        }
    }

    function Ts() {
        return new $t(ut.comparator);
    }

    function Es() {
        return new $t(ut.comparator);
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */ const As = (() => {
        const t = {
            asc: "ASCENDING",
            desc: "DESCENDING"
        };
        return t;
    })(), Rs = (() => {
        const t = {
            "<": "LESS_THAN",
            "<=": "LESS_THAN_OR_EQUAL",
            ">": "GREATER_THAN",
            ">=": "GREATER_THAN_OR_EQUAL",
            "==": "EQUAL",
            "!=": "NOT_EQUAL",
            "array-contains": "ARRAY_CONTAINS",
            in: "IN",
            "not-in": "NOT_IN",
            "array-contains-any": "ARRAY_CONTAINS_ANY"
        };
        return t;
    })();

    /**
     * This class generates JsonObject values for the Datastore API suitable for
     * sending to either GRPC stub methods or via the JSON/HTTP REST API.
     *
     * The serializer supports both Protobuf.js and Proto3 JSON formats. By
     * setting `useProto3Json` to true, the serializer will use the Proto3 JSON
     * format.
     *
     * For a description of the Proto3 JSON format check
     * https://developers.google.com/protocol-buffers/docs/proto3#json
     *
     * TODO(klimt): We can remove the databaseId argument if we keep the full
     * resource name in documents.
     */
    class bs {
        constructor(t, e) {
            this.databaseId = t, this.gt = e;
        }
    }

    /**
     * Returns a value for a Date that's appropriate to put into a proto.
     */
    function Ps(t, e) {
        if (t.gt) {
            return `${new Date(1e3 * e.seconds).toISOString().replace(/\.\d*/, "").replace("Z", "")}.${("000000000" + e.nanoseconds).slice(-9)}Z`;
        }
        return {
            seconds: "" + e.seconds,
            nanos: e.nanoseconds
        };
    }

    /**
     * Returns a value for bytes that's appropriate to put in a proto.
     *
     * Visible for testing.
     */
    function vs(t, e) {
        return t.gt ? e.toBase64() : e.toUint8Array();
    }

    /**
     * Returns a ByteString based on the proto string value.
     */ function Vs(t, e) {
        return Ps(t, e.toTimestamp());
    }

    function Ss(t) {
        return M(!!t), nt.fromTimestamp(function(t) {
            const e = zt(t);
            return new et(e.seconds, e.nanos);
        }(t));
    }

    function Ds(t, e) {
        return function(t) {
            return new it([ "projects", t.projectId, "databases", t.database ]);
        }(t).child("documents").child(e).canonicalString();
    }

    function Cs(t) {
        const e = it.fromString(t);
        return M(si(e)), e;
    }

    function xs(t, e) {
        return Ds(t.databaseId, e.path);
    }

    function Ns(t, e) {
        const n = Cs(e);
        if (n.get(1) !== t.databaseId.projectId) throw new B($.INVALID_ARGUMENT, "Tried to deserialize key from different project: " + n.get(1) + " vs " + t.databaseId.projectId);
        if (n.get(3) !== t.databaseId.database) throw new B($.INVALID_ARGUMENT, "Tried to deserialize key from different database: " + n.get(3) + " vs " + t.databaseId.database);
        return new ut(Fs(n));
    }

    function ks(t, e) {
        return Ds(t.databaseId, e);
    }

    function Ms(t) {
        const e = Cs(t);
        // In v1beta1 queries for collections at the root did not have a trailing
        // "/documents". In v1 all resource paths contain "/documents". Preserve the
        // ability to read the v1beta1 form for compatibility with queries persisted
        // in the local target cache.
            return 4 === e.length ? it.emptyPath() : Fs(e);
    }

    function Os(t) {
        return new it([ "projects", t.databaseId.projectId, "databases", t.databaseId.database ]).canonicalString();
    }

    function Fs(t) {
        return M(t.length > 4 && "documents" === t.get(4)), t.popFirst(5);
    }

    /** Creates a Document proto from key and fields (but no create/update time) */ function $s(t, e, n) {
        return {
            name: xs(t, e),
            fields: n.value.mapValue.fields
        };
    }

    function Us(t, e) {
        let n;
        if ("targetChange" in e) {
            e.targetChange;
            // proto3 default value is unset in JSON (undefined), so use 'NO_CHANGE'
            // if unset
            const s = function(t) {
                return "NO_CHANGE" === t ? 0 /* NoChange */ : "ADD" === t ? 1 /* Added */ : "REMOVE" === t ? 2 /* Removed */ : "CURRENT" === t ? 3 /* Current */ : "RESET" === t ? 4 /* Reset */ : k();
            }(e.targetChange.targetChangeType || "NO_CHANGE"), i = e.targetChange.targetIds || [], r = function(t, e) {
                return t.gt ? (M(void 0 === e || "string" == typeof e), jt.fromBase64String(e || "")) : (M(void 0 === e || e instanceof Uint8Array), 
                jt.fromUint8Array(e || new Uint8Array));
            }(t, e.targetChange.resumeToken), o = e.targetChange.cause, u = o && function(t) {
                const e = void 0 === t.code ? $.UNKNOWN : Zn(t.code);
                return new B(e, t.message || "");
            }
            /**
     * Returns a value for a number (or null) that's appropriate to put into
     * a google.protobuf.Int32Value proto.
     * DO NOT USE THIS FOR ANYTHING ELSE.
     * This method cheats. It's typed as returning "number" because that's what
     * our generated proto interfaces say Int32Value must be. But GRPC actually
     * expects a { value: <number> } struct.
     */ (o);
            n = new ys(s, i, r, u || null);
        } else if ("documentChange" in e) {
            e.documentChange;
            const s = e.documentChange;
            s.document, s.document.name, s.document.updateTime;
            const i = Ns(t, s.document.name), r = Ss(s.document.updateTime), o = new Pe({
                mapValue: {
                    fields: s.document.fields
                }
            }), u = Ve.newFoundDocument(i, r, o), c = s.targetIds || [], a = s.removedTargetIds || [];
            n = new ms(c, a, u.key, u);
        } else if ("documentDelete" in e) {
            e.documentDelete;
            const s = e.documentDelete;
            s.document;
            const i = Ns(t, s.document), r = s.readTime ? Ss(s.readTime) : nt.min(), o = Ve.newNoDocument(i, r), u = s.removedTargetIds || [];
            n = new ms([], u, o.key, o);
        } else if ("documentRemove" in e) {
            e.documentRemove;
            const s = e.documentRemove;
            s.document;
            const i = Ns(t, s.document), r = s.removedTargetIds || [];
            n = new ms([], r, i, null);
        } else {
            if (!("filter" in e)) return k();
            {
                e.filter;
                const t = e.filter;
                t.targetId;
                const s = t.count || 0, i = new Hn(s), r = t.targetId;
                n = new gs(r, i);
            }
        }
        return n;
    }

    function qs(t, e) {
        let n;
        if (e instanceof qn) n = {
            update: $s(t, e.key, e.value)
        }; else if (e instanceof Wn) n = {
            delete: xs(t, e.key)
        }; else if (e instanceof Kn) n = {
            update: $s(t, e.key, e.data),
            updateMask: ni(e.fieldMask)
        }; else {
            if (!(e instanceof zn)) return k();
            n = {
                verify: xs(t, e.key)
            };
        }
        return e.fieldTransforms.length > 0 && (n.updateTransforms = e.fieldTransforms.map((t => function(t, e) {
            const n = e.transform;
            if (n instanceof An) return {
                fieldPath: e.field.canonicalString(),
                setToServerValue: "REQUEST_TIME"
            };
            if (n instanceof Rn) return {
                fieldPath: e.field.canonicalString(),
                appendMissingElements: {
                    values: n.elements
                }
            };
            if (n instanceof Pn) return {
                fieldPath: e.field.canonicalString(),
                removeAllFromArray: {
                    values: n.elements
                }
            };
            if (n instanceof Vn) return {
                fieldPath: e.field.canonicalString(),
                increment: n.yt
            };
            throw k();
        }(0, t)))), e.precondition.isNone || (n.currentDocument = function(t, e) {
            return void 0 !== e.updateTime ? {
                updateTime: Vs(t, e.updateTime)
            } : void 0 !== e.exists ? {
                exists: e.exists
            } : k();
        }(t, e.precondition)), n;
    }

    function Gs(t, e) {
        return t && t.length > 0 ? (M(void 0 !== e), t.map((t => function(t, e) {
            // NOTE: Deletes don't have an updateTime.
            let n = t.updateTime ? Ss(t.updateTime) : Ss(e);
            return n.isEqual(nt.min()) && (
            // The Firestore Emulator currently returns an update time of 0 for
            // deletes of non-existing documents (rather than null). This breaks the
            // test "get deleted doc while offline with source=cache" as NoDocuments
            // with version 0 are filtered by IndexedDb's RemoteDocumentCache.
            // TODO(#2149): Remove this when Emulator is fixed
            n = Ss(e)), new Nn(n, t.transformResults || []);
        }(t, e)))) : [];
    }

    function Qs(t, e) {
        return {
            documents: [ ks(t, e.path) ]
        };
    }

    function js(t, e) {
        // Dissect the path into parent, collectionId, and optional key filter.
        const n = {
            structuredQuery: {}
        }, s = e.path;
        null !== e.collectionGroup ? (n.parent = ks(t, s), n.structuredQuery.from = [ {
            collectionId: e.collectionGroup,
            allDescendants: !0
        } ]) : (n.parent = ks(t, s.popLast()), n.structuredQuery.from = [ {
            collectionId: s.lastSegment()
        } ]);
        const i = function(t) {
            if (0 === t.length) return;
            const e = t.map((t => 
            // visible for testing
            function(t) {
                if ("==" /* EQUAL */ === t.op) {
                    if (ye(t.value)) return {
                        unaryFilter: {
                            field: Xs(t.field),
                            op: "IS_NAN"
                        }
                    };
                    if (ge(t.value)) return {
                        unaryFilter: {
                            field: Xs(t.field),
                            op: "IS_NULL"
                        }
                    };
                } else if ("!=" /* NOT_EQUAL */ === t.op) {
                    if (ye(t.value)) return {
                        unaryFilter: {
                            field: Xs(t.field),
                            op: "IS_NOT_NAN"
                        }
                    };
                    if (ge(t.value)) return {
                        unaryFilter: {
                            field: Xs(t.field),
                            op: "IS_NOT_NULL"
                        }
                    };
                }
                return {
                    fieldFilter: {
                        field: Xs(t.field),
                        op: Ys(t.op),
                        value: t.value
                    }
                };
            }(t)));
            if (1 === e.length) return e[0];
            return {
                compositeFilter: {
                    op: "AND",
                    filters: e
                }
            };
        }(e.filters);
        i && (n.structuredQuery.where = i);
        const r = function(t) {
            if (0 === t.length) return;
            return t.map((t => 
            // visible for testing
            function(t) {
                return {
                    field: Xs(t.field),
                    direction: Js(t.dir)
                };
            }(t)));
        }(e.orderBy);
        r && (n.structuredQuery.orderBy = r);
        const o = function(t, e) {
            return t.gt || ne(e) ? e : {
                value: e
            };
        }
        /**
     * Returns a number (or null) from a google.protobuf.Int32Value proto.
     */ (t, e.limit);
        var u;
        return null !== o && (n.structuredQuery.limit = o), e.startAt && (n.structuredQuery.startAt = {
            before: (u = e.startAt).inclusive,
            values: u.position
        }), e.endAt && (n.structuredQuery.endAt = function(t) {
            return {
                before: !t.inclusive,
                values: t.position
            };
        }(e.endAt)), n;
    }

    function Ws(t) {
        let e = Ms(t.parent);
        const n = t.structuredQuery, s = n.from ? n.from.length : 0;
        let i = null;
        if (s > 0) {
            M(1 === s);
            const t = n.from[0];
            t.allDescendants ? i = t.collectionId : e = e.child(t.collectionId);
        }
        let r = [];
        n.where && (r = Hs(n.where));
        let o = [];
        n.orderBy && (o = n.orderBy.map((t => function(t) {
            return new ze(Zs(t.field), 
            // visible for testing
            function(t) {
                switch (t) {
                  case "ASCENDING":
                    return "asc" /* ASCENDING */;

                  case "DESCENDING":
                    return "desc" /* DESCENDING */;

                  default:
                    return;
                }
            }
            // visible for testing
            (t.direction));
        }(t))));
        let u = null;
        n.limit && (u = function(t) {
            let e;
            return e = "object" == typeof t ? t.value : t, ne(e) ? null : e;
        }(n.limit));
        let c = null;
        n.startAt && (c = function(t) {
            const e = !!t.before, n = t.values || [];
            return new We(n, e);
        }(n.startAt));
        let a = null;
        return n.endAt && (a = function(t) {
            const e = !t.before, n = t.values || [];
            return new We(n, e);
        }
        // visible for testing
        (n.endAt)), Ze(e, i, o, r, u, "F" /* First */ , c, a);
    }

    function zs(t, e) {
        const n = function(t, e) {
            switch (e) {
              case 0 /* Listen */ :
                return null;

              case 1 /* ExistenceFilterMismatch */ :
                return "existence-filter-mismatch";

              case 2 /* LimboResolution */ :
                return "limbo-document";

              default:
                return k();
            }
        }(0, e.purpose);
        return null == n ? null : {
            "goog-listen-tags": n
        };
    }

    function Hs(t) {
        return t ? void 0 !== t.unaryFilter ? [ ei(t) ] : void 0 !== t.fieldFilter ? [ ti(t) ] : void 0 !== t.compositeFilter ? t.compositeFilter.filters.map((t => Hs(t))).reduce(((t, e) => t.concat(e))) : k() : [];
    }

    function Js(t) {
        return As[t];
    }

    function Ys(t) {
        return Rs[t];
    }

    function Xs(t) {
        return {
            fieldPath: t.canonicalString()
        };
    }

    function Zs(t) {
        return ot.fromServerFormat(t.fieldPath);
    }

    function ti(t) {
        return $e.create(Zs(t.fieldFilter.field), function(t) {
            switch (t) {
              case "EQUAL":
                return "==" /* EQUAL */;

              case "NOT_EQUAL":
                return "!=" /* NOT_EQUAL */;

              case "GREATER_THAN":
                return ">" /* GREATER_THAN */;

              case "GREATER_THAN_OR_EQUAL":
                return ">=" /* GREATER_THAN_OR_EQUAL */;

              case "LESS_THAN":
                return "<" /* LESS_THAN */;

              case "LESS_THAN_OR_EQUAL":
                return "<=" /* LESS_THAN_OR_EQUAL */;

              case "ARRAY_CONTAINS":
                return "array-contains" /* ARRAY_CONTAINS */;

              case "IN":
                return "in" /* IN */;

              case "NOT_IN":
                return "not-in" /* NOT_IN */;

              case "ARRAY_CONTAINS_ANY":
                return "array-contains-any" /* ARRAY_CONTAINS_ANY */;

              default:
                return k();
            }
        }(t.fieldFilter.op), t.fieldFilter.value);
    }

    function ei(t) {
        switch (t.unaryFilter.op) {
          case "IS_NAN":
            const e = Zs(t.unaryFilter.field);
            return $e.create(e, "==" /* EQUAL */ , {
                doubleValue: NaN
            });

          case "IS_NULL":
            const n = Zs(t.unaryFilter.field);
            return $e.create(n, "==" /* EQUAL */ , {
                nullValue: "NULL_VALUE"
            });

          case "IS_NOT_NAN":
            const s = Zs(t.unaryFilter.field);
            return $e.create(s, "!=" /* NOT_EQUAL */ , {
                doubleValue: NaN
            });

          case "IS_NOT_NULL":
            const i = Zs(t.unaryFilter.field);
            return $e.create(i, "!=" /* NOT_EQUAL */ , {
                nullValue: "NULL_VALUE"
            });

          default:
            return k();
        }
    }

    function ni(t) {
        const e = [];
        return t.fields.forEach((t => e.push(t.canonicalString()))), {
            fieldPaths: e
        };
    }

    function si(t) {
        // Resource names have at least 4 components (project ID, database ID)
        return t.length >= 4 && "projects" === t.get(0) && "databases" === t.get(2);
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * A batch of mutations that will be sent as one unit to the backend.
     */ class Ni {
        /**
         * @param batchId - The unique ID of this mutation batch.
         * @param localWriteTime - The original write time of this mutation.
         * @param baseMutations - Mutations that are used to populate the base
         * values when this mutation is applied locally. This can be used to locally
         * overwrite values that are persisted in the remote document cache. Base
         * mutations are never sent to the backend.
         * @param mutations - The user-provided mutations in this mutation batch.
         * User-provided mutations are applied both locally and remotely on the
         * backend.
         */
        constructor(t, e, n, s) {
            this.batchId = t, this.localWriteTime = e, this.baseMutations = n, this.mutations = s;
        }
        /**
         * Applies all the mutations in this MutationBatch to the specified document
         * to compute the state of the remote document
         *
         * @param document - The document to apply mutations to.
         * @param batchResult - The result of applying the MutationBatch to the
         * backend.
         */    applyToRemoteDocument(t, e) {
            const n = e.mutationResults;
            for (let e = 0; e < this.mutations.length; e++) {
                const s = this.mutations[e];
                if (s.key.isEqual(t.key)) {
                    $n(s, t, n[e]);
                }
            }
        }
        /**
         * Computes the local view of a document given all the mutations in this
         * batch.
         *
         * @param document - The document to apply mutations to.
         * @param mutatedFields - Fields that have been updated before applying this mutation batch.
         * @returns A `FieldMask` representing all the fields that are mutated.
         */    applyToLocalView(t, e) {
            // First, apply the base state. This allows us to apply non-idempotent
            // transform against a consistent set of values.
            for (const n of this.baseMutations) n.key.isEqual(t.key) && (e = Bn(n, t, e, this.localWriteTime));
            // Second, apply all user-provided mutations.
                    for (const n of this.mutations) n.key.isEqual(t.key) && (e = Bn(n, t, e, this.localWriteTime));
            return e;
        }
        /**
         * Computes the local view for all provided documents given the mutations in
         * this batch. Returns a `DocumentKey` to `Mutation` map which can be used to
         * replace all the mutation applications.
         */    applyToLocalDocumentSet(t, e) {
            // TODO(mrschmidt): This implementation is O(n^2). If we apply the mutations
            // directly (as done in `applyToLocalView()`), we can reduce the complexity
            // to O(n).
            const n = us();
            return this.mutations.forEach((s => {
                const i = t.get(s.key), r = i.overlayedDocument;
                // TODO(mutabledocuments): This method should take a MutableDocumentMap
                // and we should remove this cast.
                            let o = this.applyToLocalView(r, i.mutatedFields);
                // Set mutatedFields to null if the document is only from local mutations.
                // This creates a Set or Delete mutation, instead of trying to create a
                // patch mutation as the overlay.
                            o = e.has(s.key) ? null : o;
                const u = Fn(r, o);
                null !== u && n.set(s.key, u), r.isValidDocument() || r.convertToNoDocument(nt.min());
            })), n;
        }
        keys() {
            return this.mutations.reduce(((t, e) => t.add(e.key)), ls());
        }
        isEqual(t) {
            return this.batchId === t.batchId && Z(this.mutations, t.mutations, ((t, e) => Un(t, e))) && Z(this.baseMutations, t.baseMutations, ((t, e) => Un(t, e)));
        }
    }

    /** The result of applying a mutation batch to the backend. */ class ki {
        constructor(t, e, n, 
        /**
         * A pre-computed mapping from each mutated document to the resulting
         * version.
         */
        s) {
            this.batch = t, this.commitVersion = e, this.mutationResults = n, this.docVersions = s;
        }
        /**
         * Creates a new MutationBatchResult for the given batch and results. There
         * must be one result for each mutation in the batch. This static factory
         * caches a document=&gt;version mapping (docVersions).
         */    static from(t, e, n) {
            M(t.mutations.length === n.length);
            let s = as;
            const i = t.mutations;
            for (let t = 0; t < i.length; t++) s = s.insert(i[t].key, n[t].version);
            return new ki(t, e, n, s);
        }
    }

    /**
     * @license
     * Copyright 2022 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Representation of an overlay computed by Firestore.
     *
     * Holds information about a mutation and the largest batch id in Firestore when
     * the mutation was created.
     */ class Mi {
        constructor(t, e) {
            this.largestBatchId = t, this.mutation = e;
        }
        getKey() {
            return this.mutation.key;
        }
        isEqual(t) {
            return null !== t && this.mutation === t.mutation;
        }
        toString() {
            return `Overlay{\n      largestBatchId: ${this.largestBatchId},\n      mutation: ${this.mutation.toString()}\n    }`;
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * An immutable set of metadata that the local store tracks for each target.
     */ class Oi {
        constructor(
        /** The target being listened to. */
        t, 
        /**
         * The target ID to which the target corresponds; Assigned by the
         * LocalStore for user listens and by the SyncEngine for limbo watches.
         */
        e, 
        /** The purpose of the target. */
        n, 
        /**
         * The sequence number of the last transaction during which this target data
         * was modified.
         */
        s, 
        /** The latest snapshot version seen for this target. */
        i = nt.min()
        /**
         * The maximum snapshot version at which the associated view
         * contained no limbo documents.
         */ , r = nt.min()
        /**
         * An opaque, server-assigned token that allows watching a target to be
         * resumed after disconnecting without retransmitting all the data that
         * matches the target. The resume token essentially identifies a point in
         * time from which the server should resume sending results.
         */ , o = jt.EMPTY_BYTE_STRING) {
            this.target = t, this.targetId = e, this.purpose = n, this.sequenceNumber = s, this.snapshotVersion = i, 
            this.lastLimboFreeSnapshotVersion = r, this.resumeToken = o;
        }
        /** Creates a new target data instance with an updated sequence number. */    withSequenceNumber(t) {
            return new Oi(this.target, this.targetId, this.purpose, t, this.snapshotVersion, this.lastLimboFreeSnapshotVersion, this.resumeToken);
        }
        /**
         * Creates a new target data instance with an updated resume token and
         * snapshot version.
         */    withResumeToken(t, e) {
            return new Oi(this.target, this.targetId, this.purpose, this.sequenceNumber, e, this.lastLimboFreeSnapshotVersion, t);
        }
        /**
         * Creates a new target data instance with an updated last limbo free
         * snapshot version number.
         */    withLastLimboFreeSnapshotVersion(t) {
            return new Oi(this.target, this.targetId, this.purpose, this.sequenceNumber, this.snapshotVersion, t, this.resumeToken);
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /** Serializer for values stored in the LocalStore. */ class Fi {
        constructor(t) {
            this.re = t;
        }
    }

    /**
     * A helper function for figuring out what kind of query has been stored.
     */
    /**
     * Encodes a `BundledQuery` from bundle proto to a Query object.
     *
     * This reconstructs the original query used to build the bundle being loaded,
     * including features exists only in SDKs (for example: limit-to-last).
     */
    function ji(t) {
        const e = Ws({
            parent: t.parent,
            structuredQuery: t.structuredQuery
        });
        return "LAST" === t.limitType ? cn(e, e.limit, "L" /* Last */) : e;
    }

    /**
     * @license
     * Copyright 2019 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * An in-memory implementation of IndexManager.
     */ class fr {
        constructor() {
            this.Ye = new dr;
        }
        addToCollectionParentIndex(t, e) {
            return this.Ye.add(e), Et.resolve();
        }
        getCollectionParents(t, e) {
            return Et.resolve(this.Ye.getEntries(e));
        }
        addFieldIndex(t, e) {
            // Field indices are not supported with memory persistence.
            return Et.resolve();
        }
        deleteFieldIndex(t, e) {
            // Field indices are not supported with memory persistence.
            return Et.resolve();
        }
        getDocumentsMatchingTarget(t, e) {
            // Field indices are not supported with memory persistence.
            return Et.resolve(null);
        }
        getIndexType(t, e) {
            // Field indices are not supported with memory persistence.
            return Et.resolve(0 /* NONE */);
        }
        getFieldIndexes(t, e) {
            // Field indices are not supported with memory persistence.
            return Et.resolve([]);
        }
        getNextCollectionGroupToUpdate(t) {
            // Field indices are not supported with memory persistence.
            return Et.resolve(null);
        }
        getMinOffset(t, e) {
            return Et.resolve(gt.min());
        }
        getMinOffsetFromCollectionGroup(t, e) {
            return Et.resolve(gt.min());
        }
        updateCollectionGroup(t, e, n) {
            // Field indices are not supported with memory persistence.
            return Et.resolve();
        }
        updateIndexEntries(t, e) {
            // Field indices are not supported with memory persistence.
            return Et.resolve();
        }
    }

    /**
     * Internal implementation of the collection-parent index exposed by MemoryIndexManager.
     * Also used for in-memory caching by IndexedDbIndexManager and initial index population
     * in indexeddb_schema.ts
     */ class dr {
        constructor() {
            this.index = {};
        }
        // Returns false if the entry already existed.
        add(t) {
            const e = t.lastSegment(), n = t.popLast(), s = this.index[e] || new Ut(it.comparator), i = !s.has(n);
            return this.index[e] = s.add(n), i;
        }
        has(t) {
            const e = t.lastSegment(), n = t.popLast(), s = this.index[e];
            return s && s.has(n);
        }
        getEntries(t) {
            return (this.index[t] || new Ut(it.comparator)).toArray();
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /** Offset to ensure non-overlapping target ids. */
    /**
     * Generates monotonically increasing target IDs for sending targets to the
     * watch stream.
     *
     * The client constructs two generators, one for the target cache, and one for
     * for the sync engine (to generate limbo documents targets). These
     * generators produce non-overlapping IDs (by using even and odd IDs
     * respectively).
     *
     * By separating the target ID space, the query cache can generate target IDs
     * that persist across client restarts, while sync engine can independently
     * generate in-memory target IDs that are transient and can be reused after a
     * restart.
     */
    class Dr {
        constructor(t) {
            this.bn = t;
        }
        next() {
            return this.bn += 2, this.bn;
        }
        static Pn() {
            // The target cache generator must return '2' in its first call to `next()`
            // as there is no differentiation in the protocol layer between an unset
            // number and the number '0'. If we were to sent a target with target ID
            // '0', the backend would consider it unset and replace it with its own ID.
            return new Dr(0);
        }
        static vn() {
            // Sync engine assigns target IDs for limbo document detection.
            return new Dr(-1);
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * An in-memory buffer of entries to be written to a RemoteDocumentCache.
     * It can be used to batch up a set of changes to be written to the cache, but
     * additionally supports reading entries back with the `getEntry()` method,
     * falling back to the underlying RemoteDocumentCache if no entry is
     * buffered.
     *
     * Entries added to the cache *must* be read first. This is to facilitate
     * calculating the size delta of the pending changes.
     *
     * PORTING NOTE: This class was implemented then removed from other platforms.
     * If byte-counting ends up being needed on the other platforms, consider
     * porting this class as part of that implementation work.
     */ class Ur {
        constructor() {
            // A mapping of document key to the new cache entry that should be written.
            this.changes = new ts((t => t.toString()), ((t, e) => t.isEqual(e))), this.changesApplied = !1;
        }
        /**
         * Buffers a `RemoteDocumentCache.addEntry()` call.
         *
         * You can only modify documents that have already been retrieved via
         * `getEntry()/getEntries()` (enforced via IndexedDbs `apply()`).
         */    addEntry(t) {
            this.assertNotApplied(), this.changes.set(t.key, t);
        }
        /**
         * Buffers a `RemoteDocumentCache.removeEntry()` call.
         *
         * You can only remove documents that have already been retrieved via
         * `getEntry()/getEntries()` (enforced via IndexedDbs `apply()`).
         */    removeEntry(t, e) {
            this.assertNotApplied(), this.changes.set(t, Ve.newInvalidDocument(t).setReadTime(e));
        }
        /**
         * Looks up an entry in the cache. The buffered changes will first be checked,
         * and if no buffered change applies, this will forward to
         * `RemoteDocumentCache.getEntry()`.
         *
         * @param transaction - The transaction in which to perform any persistence
         *     operations.
         * @param documentKey - The key of the entry to look up.
         * @returns The cached document or an invalid document if we have nothing
         * cached.
         */    getEntry(t, e) {
            this.assertNotApplied();
            const n = this.changes.get(e);
            return void 0 !== n ? Et.resolve(n) : this.getFromCache(t, e);
        }
        /**
         * Looks up several entries in the cache, forwarding to
         * `RemoteDocumentCache.getEntry()`.
         *
         * @param transaction - The transaction in which to perform any persistence
         *     operations.
         * @param documentKeys - The keys of the entries to look up.
         * @returns A map of cached documents, indexed by key. If an entry cannot be
         *     found, the corresponding key will be mapped to an invalid document.
         */    getEntries(t, e) {
            return this.getAllFromCache(t, e);
        }
        /**
         * Applies buffered changes to the underlying RemoteDocumentCache, using
         * the provided transaction.
         */    apply(t) {
            return this.assertNotApplied(), this.changesApplied = !0, this.applyChanges(t);
        }
        /** Helper to assert this.changes is not null  */    assertNotApplied() {}
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Schema Version for the Web client:
     * 1.  Initial version including Mutation Queue, Query Cache, and Remote
     *     Document Cache
     * 2.  Used to ensure a targetGlobal object exists and add targetCount to it. No
     *     longer required because migration 3 unconditionally clears it.
     * 3.  Dropped and re-created Query Cache to deal with cache corruption related
     *     to limbo resolution. Addresses
     *     https://github.com/firebase/firebase-ios-sdk/issues/1548
     * 4.  Multi-Tab Support.
     * 5.  Removal of held write acks.
     * 6.  Create document global for tracking document cache size.
     * 7.  Ensure every cached document has a sentinel row with a sequence number.
     * 8.  Add collection-parent index for Collection Group queries.
     * 9.  Change RemoteDocumentChanges store to be keyed by readTime rather than
     *     an auto-incrementing ID. This is required for Index-Free queries.
     * 10. Rewrite the canonical IDs to the explicit Protobuf-based format.
     * 11. Add bundles and named_queries for bundle support.
     * 12. Add document overlays.
     * 13. Rewrite the keys of the remote document cache to allow for efficient
     *     document lookup via `getAll()`.
     * 14. Add overlays.
     * 15. Add indexing support.
     */
    /**
     * @license
     * Copyright 2022 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Represents a local view (overlay) of a document, and the fields that are
     * locally mutated.
     */
    class Jr {
        constructor(t, 
        /**
         * The fields that are locally mutated by patch mutations. If the overlayed
         * document is from set or delete mutations, this returns null.
         */
        e) {
            this.overlayedDocument = t, this.mutatedFields = e;
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * A readonly view of the local state of all documents we're tracking (i.e. we
     * have a cached version in remoteDocumentCache or local mutations for the
     * document). The view is computed by applying the mutations in the
     * MutationQueue to the RemoteDocumentCache.
     */ class Yr {
        constructor(t, e, n, s) {
            this.remoteDocumentCache = t, this.mutationQueue = e, this.documentOverlayCache = n, 
            this.indexManager = s;
        }
        /**
         * Get the local view of the document identified by `key`.
         *
         * @returns Local view of the document or null if we don't have any cached
         * state for it.
         */    getDocument(t, e) {
            let n = null;
            return this.documentOverlayCache.getOverlay(t, e).next((s => (n = s, this.getBaseDocument(t, e, n)))).next((t => (null !== n && Bn(n.mutation, t, Gt.empty(), et.now()), 
            t)));
        }
        /**
         * Gets the local view of the documents identified by `keys`.
         *
         * If we don't have cached state for a document in `keys`, a NoDocument will
         * be stored for that key in the resulting set.
         */    getDocuments(t, e) {
            return this.remoteDocumentCache.getEntries(t, e).next((e => this.getLocalViewOfDocuments(t, e, ls()).next((() => e))));
        }
        /**
         * Similar to `getDocuments`, but creates the local view from the given
         * `baseDocs` without retrieving documents from the local store.
         *
         * @param transaction - The transaction this operation is scoped to.
         * @param docs - The documents to apply local mutations to get the local views.
         * @param existenceStateChanged - The set of document keys whose existence state
         *   is changed. This is useful to determine if some documents overlay needs
         *   to be recalculated.
         */    getLocalViewOfDocuments(t, e, n = ls()) {
            const s = os();
            return this.populateOverlays(t, s, e).next((() => this.computeViews(t, e, s, n).next((t => {
                let e = is();
                return t.forEach(((t, n) => {
                    e = e.insert(t, n.overlayedDocument);
                })), e;
            }))));
        }
        /**
         * Gets the overlayed documents for the given document map, which will include
         * the local view of those documents and a `FieldMask` indicating which fields
         * are mutated locally, `null` if overlay is a Set or Delete mutation.
         */    getOverlayedDocuments(t, e) {
            const n = os();
            return this.populateOverlays(t, n, e).next((() => this.computeViews(t, e, n, ls())));
        }
        /**
         * Fetches the overlays for {@code docs} and adds them to provided overlay map
         * if the map does not already contain an entry for the given document key.
         */    populateOverlays(t, e, n) {
            const s = [];
            return n.forEach((t => {
                e.has(t) || s.push(t);
            })), this.documentOverlayCache.getOverlays(t, s).next((t => {
                t.forEach(((t, n) => {
                    e.set(t, n);
                }));
            }));
        }
        /**
         * Computes the local view for the given documents.
         *
         * @param docs - The documents to compute views for. It also has the base
         *   version of the documents.
         * @param overlays - The overlays that need to be applied to the given base
         *   version of the documents.
         * @param existenceStateChanged - A set of documents whose existence states
         *   might have changed. This is used to determine if we need to re-calculate
         *   overlays from mutation queues.
         * @return A map represents the local documents view.
         */    computeViews(t, e, n, s) {
            let i = ns();
            const r = cs(), o = cs();
            return e.forEach(((t, e) => {
                const o = n.get(e.key);
                // Recalculate an overlay if the document's existence state changed due to
                // a remote event *and* the overlay is a PatchMutation. This is because
                // document existence state can change if some patch mutation's
                // preconditions are met.
                // NOTE: we recalculate when `overlay` is undefined as well, because there
                // might be a patch mutation whose precondition does not match before the
                // change (hence overlay is undefined), but would now match.
                            s.has(e.key) && (void 0 === o || o.mutation instanceof Kn) ? i = i.insert(e.key, e) : void 0 !== o && (r.set(e.key, o.mutation.getFieldMask()), 
                Bn(o.mutation, e, o.mutation.getFieldMask(), et.now()));
            })), this.recalculateAndSaveOverlays(t, i).next((t => (t.forEach(((t, e) => r.set(t, e))), 
            e.forEach(((t, e) => {
                var n;
                return o.set(t, new Jr(e, null !== (n = r.get(t)) && void 0 !== n ? n : null));
            })), o)));
        }
        recalculateAndSaveOverlays(t, e) {
            const n = cs();
            // A reverse lookup map from batch id to the documents within that batch.
                    let s = new $t(((t, e) => t - e)), i = ls();
            return this.mutationQueue.getAllMutationBatchesAffectingDocumentKeys(t, e).next((t => {
                for (const i of t) i.keys().forEach((t => {
                    const r = e.get(t);
                    if (null === r) return;
                    let o = n.get(t) || Gt.empty();
                    o = i.applyToLocalView(r, o), n.set(t, o);
                    const u = (s.get(i.batchId) || ls()).add(t);
                    s = s.insert(i.batchId, u);
                }));
            })).next((() => {
                const r = [], o = s.getReverseIterator();
                // Iterate in descending order of batch IDs, and skip documents that are
                // already saved.
                            for (;o.hasNext(); ) {
                    const s = o.getNext(), u = s.key, c = s.value, a = us();
                    c.forEach((t => {
                        if (!i.has(t)) {
                            const s = Fn(e.get(t), n.get(t));
                            null !== s && a.set(t, s), i = i.add(t);
                        }
                    })), r.push(this.documentOverlayCache.saveOverlays(t, u, a));
                }
                return Et.waitFor(r);
            })).next((() => n));
        }
        /**
         * Recalculates overlays by reading the documents from remote document cache
         * first, and saves them after they are calculated.
         */    recalculateAndSaveOverlaysForDocumentKeys(t, e) {
            return this.remoteDocumentCache.getEntries(t, e).next((e => this.recalculateAndSaveOverlays(t, e)));
        }
        /**
         * Performs a query against the local view of all documents.
         *
         * @param transaction - The persistence transaction.
         * @param query - The query to match documents against.
         * @param offset - Read time and key to start scanning by (exclusive).
         */    getDocumentsMatchingQuery(t, e, n) {
            /**
     * Returns whether the query matches a single document by path (rather than a
     * collection).
     */
            return function(t) {
                return ut.isDocumentKey(t.path) && null === t.collectionGroup && 0 === t.filters.length;
            }(e) ? this.getDocumentsMatchingDocumentQuery(t, e.path) : rn(e) ? this.getDocumentsMatchingCollectionGroupQuery(t, e, n) : this.getDocumentsMatchingCollectionQuery(t, e, n);
        }
        /**
         * Given a collection group, returns the next documents that follow the provided offset, along
         * with an updated batch ID.
         *
         * <p>The documents returned by this method are ordered by remote version from the provided
         * offset. If there are no more remote documents after the provided offset, documents with
         * mutations in order of batch id from the offset are returned. Since all documents in a batch are
         * returned together, the total number of documents returned can exceed {@code count}.
         *
         * @param transaction
         * @param collectionGroup The collection group for the documents.
         * @param offset The offset to index into.
         * @param count The number of documents to return
         * @return A LocalWriteResult with the documents that follow the provided offset and the last processed batch id.
         */    getNextDocuments(t, e, n, s) {
            return this.remoteDocumentCache.getAllFromCollectionGroup(t, e, n, s).next((i => {
                const r = s - i.size > 0 ? this.documentOverlayCache.getOverlaysForCollectionGroup(t, e, n.largestBatchId, s - i.size) : Et.resolve(os());
                // The callsite will use the largest batch ID together with the latest read time to create
                // a new index offset. Since we only process batch IDs if all remote documents have been read,
                // no overlay will increase the overall read time. This is why we only need to special case
                // the batch id.
                            let o = -1, u = i;
                return r.next((e => Et.forEach(e, ((e, n) => (o < n.largestBatchId && (o = n.largestBatchId), 
                i.get(e) ? Et.resolve() : this.getBaseDocument(t, e, n).next((t => {
                    u = u.insert(e, t);
                }))))).next((() => this.populateOverlays(t, e, i))).next((() => this.computeViews(t, u, e, ls()))).next((t => ({
                    batchId: o,
                    changes: rs(t)
                })))));
            }));
        }
        getDocumentsMatchingDocumentQuery(t, e) {
            // Just do a simple document lookup.
            return this.getDocument(t, new ut(e)).next((t => {
                let e = is();
                return t.isFoundDocument() && (e = e.insert(t.key, t)), e;
            }));
        }
        getDocumentsMatchingCollectionGroupQuery(t, e, n) {
            const s = e.collectionGroup;
            let i = is();
            return this.indexManager.getCollectionParents(t, s).next((r => Et.forEach(r, (r => {
                const o = function(t, e) {
                    return new Xe(e, 
                    /*collectionGroup=*/ null, t.explicitOrderBy.slice(), t.filters.slice(), t.limit, t.limitType, t.startAt, t.endAt);
                }(e, r.child(s));
                return this.getDocumentsMatchingCollectionQuery(t, o, n).next((t => {
                    t.forEach(((t, e) => {
                        i = i.insert(t, e);
                    }));
                }));
            })).next((() => i))));
        }
        getDocumentsMatchingCollectionQuery(t, e, n) {
            // Query the remote documents and overlay mutations.
            let s;
            return this.remoteDocumentCache.getAllFromCollection(t, e.path, n).next((i => (s = i, 
            this.documentOverlayCache.getOverlaysForCollection(t, e.path, n.largestBatchId)))).next((t => {
                // As documents might match the query because of their overlay we need to
                // include documents for all overlays in the initial document set.
                t.forEach(((t, e) => {
                    const n = e.getKey();
                    null === s.get(n) && (s = s.insert(n, Ve.newInvalidDocument(n)));
                }));
                // Apply the overlays and match against the query.
                let n = is();
                return s.forEach(((s, i) => {
                    const r = t.get(s);
                    void 0 !== r && Bn(r.mutation, i, Gt.empty(), et.now()), 
                    // Finally, insert the documents that still match the query
                    fn(e, i) && (n = n.insert(s, i));
                })), n;
            }));
        }
        /** Returns a base document that can be used to apply `overlay`. */    getBaseDocument(t, e, n) {
            return null === n || 1 /* Patch */ === n.mutation.type ? this.remoteDocumentCache.getEntry(t, e) : Et.resolve(Ve.newInvalidDocument(e));
        }
    }

    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */ class Xr {
        constructor(t) {
            this.It = t, this.Zn = new Map, this.ts = new Map;
        }
        getBundleMetadata(t, e) {
            return Et.resolve(this.Zn.get(e));
        }
        saveBundleMetadata(t, e) {
            /** Decodes a BundleMetadata proto into a BundleMetadata object. */
            var n;
            return this.Zn.set(e.id, {
                id: (n = e).id,
                version: n.version,
                createTime: Ss(n.createTime)
            }), Et.resolve();
        }
        getNamedQuery(t, e) {
            return Et.resolve(this.ts.get(e));
        }
        saveNamedQuery(t, e) {
            return this.ts.set(e.name, function(t) {
                return {
                    name: t.name,
                    query: ji(t.bundledQuery),
                    readTime: Ss(t.readTime)
                };
            }(e)), Et.resolve();
        }
    }

    /**
     * @license
     * Copyright 2022 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * An in-memory implementation of DocumentOverlayCache.
     */ class Zr {
        constructor() {
            // A map sorted by DocumentKey, whose value is a pair of the largest batch id
            // for the overlay and the overlay itself.
            this.overlays = new $t(ut.comparator), this.es = new Map;
        }
        getOverlay(t, e) {
            return Et.resolve(this.overlays.get(e));
        }
        getOverlays(t, e) {
            const n = os();
            return Et.forEach(e, (e => this.getOverlay(t, e).next((t => {
                null !== t && n.set(e, t);
            })))).next((() => n));
        }
        saveOverlays(t, e, n) {
            return n.forEach(((n, s) => {
                this.ue(t, e, s);
            })), Et.resolve();
        }
        removeOverlaysForBatchId(t, e, n) {
            const s = this.es.get(n);
            return void 0 !== s && (s.forEach((t => this.overlays = this.overlays.remove(t))), 
            this.es.delete(n)), Et.resolve();
        }
        getOverlaysForCollection(t, e, n) {
            const s = os(), i = e.length + 1, r = new ut(e.child("")), o = this.overlays.getIteratorFrom(r);
            for (;o.hasNext(); ) {
                const t = o.getNext().value, r = t.getKey();
                if (!e.isPrefixOf(r.path)) break;
                // Documents from sub-collections
                            r.path.length === i && (t.largestBatchId > n && s.set(t.getKey(), t));
            }
            return Et.resolve(s);
        }
        getOverlaysForCollectionGroup(t, e, n, s) {
            let i = new $t(((t, e) => t - e));
            const r = this.overlays.getIterator();
            for (;r.hasNext(); ) {
                const t = r.getNext().value;
                if (t.getKey().getCollectionGroup() === e && t.largestBatchId > n) {
                    let e = i.get(t.largestBatchId);
                    null === e && (e = os(), i = i.insert(t.largestBatchId, e)), e.set(t.getKey(), t);
                }
            }
            const o = os(), u = i.getIterator();
            for (;u.hasNext(); ) {
                if (u.getNext().value.forEach(((t, e) => o.set(t, e))), o.size() >= s) break;
            }
            return Et.resolve(o);
        }
        ue(t, e, n) {
            // Remove the association of the overlay to its batch id.
            const s = this.overlays.get(n.key);
            if (null !== s) {
                const t = this.es.get(s.largestBatchId).delete(n.key);
                this.es.set(s.largestBatchId, t);
            }
            this.overlays = this.overlays.insert(n.key, new Mi(e, n));
            // Create the association of this overlay to the given largestBatchId.
            let i = this.es.get(e);
            void 0 === i && (i = ls(), this.es.set(e, i)), this.es.set(e, i.add(n.key));
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * A collection of references to a document from some kind of numbered entity
     * (either a target ID or batch ID). As references are added to or removed from
     * the set corresponding events are emitted to a registered garbage collector.
     *
     * Each reference is represented by a DocumentReference object. Each of them
     * contains enough information to uniquely identify the reference. They are all
     * stored primarily in a set sorted by key. A document is considered garbage if
     * there's no references in that set (this can be efficiently checked thanks to
     * sorting by key).
     *
     * ReferenceSet also keeps a secondary set that contains references sorted by
     * IDs. This one is used to efficiently implement removal of all references by
     * some target ID.
     */ class to {
        constructor() {
            // A set of outstanding references to a document sorted by key.
            this.ns = new Ut(eo.ss), 
            // A set of outstanding references to a document sorted by target id.
            this.rs = new Ut(eo.os);
        }
        /** Returns true if the reference set contains no references. */    isEmpty() {
            return this.ns.isEmpty();
        }
        /** Adds a reference to the given document key for the given ID. */    addReference(t, e) {
            const n = new eo(t, e);
            this.ns = this.ns.add(n), this.rs = this.rs.add(n);
        }
        /** Add references to the given document keys for the given ID. */    us(t, e) {
            t.forEach((t => this.addReference(t, e)));
        }
        /**
         * Removes a reference to the given document key for the given
         * ID.
         */    removeReference(t, e) {
            this.cs(new eo(t, e));
        }
        hs(t, e) {
            t.forEach((t => this.removeReference(t, e)));
        }
        /**
         * Clears all references with a given ID. Calls removeRef() for each key
         * removed.
         */    ls(t) {
            const e = new ut(new it([])), n = new eo(e, t), s = new eo(e, t + 1), i = [];
            return this.rs.forEachInRange([ n, s ], (t => {
                this.cs(t), i.push(t.key);
            })), i;
        }
        fs() {
            this.ns.forEach((t => this.cs(t)));
        }
        cs(t) {
            this.ns = this.ns.delete(t), this.rs = this.rs.delete(t);
        }
        ds(t) {
            const e = new ut(new it([])), n = new eo(e, t), s = new eo(e, t + 1);
            let i = ls();
            return this.rs.forEachInRange([ n, s ], (t => {
                i = i.add(t.key);
            })), i;
        }
        containsKey(t) {
            const e = new eo(t, 0), n = this.ns.firstAfterOrEqual(e);
            return null !== n && t.isEqual(n.key);
        }
    }

    class eo {
        constructor(t, e) {
            this.key = t, this._s = e;
        }
        /** Compare by key then by ID */    static ss(t, e) {
            return ut.comparator(t.key, e.key) || X(t._s, e._s);
        }
        /** Compare by ID then by key */    static os(t, e) {
            return X(t._s, e._s) || ut.comparator(t.key, e.key);
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */ class no {
        constructor(t, e) {
            this.indexManager = t, this.referenceDelegate = e, 
            /**
             * The set of all mutations that have been sent but not yet been applied to
             * the backend.
             */
            this.mutationQueue = [], 
            /** Next value to use when assigning sequential IDs to each mutation batch. */
            this.ws = 1, 
            /** An ordered mapping between documents and the mutations batch IDs. */
            this.gs = new Ut(eo.ss);
        }
        checkEmpty(t) {
            return Et.resolve(0 === this.mutationQueue.length);
        }
        addMutationBatch(t, e, n, s) {
            const i = this.ws;
            this.ws++, this.mutationQueue.length > 0 && this.mutationQueue[this.mutationQueue.length - 1];
            const r = new Ni(i, e, n, s);
            this.mutationQueue.push(r);
            // Track references by document key and index collection parents.
            for (const e of s) this.gs = this.gs.add(new eo(e.key, i)), this.indexManager.addToCollectionParentIndex(t, e.key.path.popLast());
            return Et.resolve(r);
        }
        lookupMutationBatch(t, e) {
            return Et.resolve(this.ys(e));
        }
        getNextMutationBatchAfterBatchId(t, e) {
            const n = e + 1, s = this.ps(n), i = s < 0 ? 0 : s;
            // The requested batchId may still be out of range so normalize it to the
            // start of the queue.
                    return Et.resolve(this.mutationQueue.length > i ? this.mutationQueue[i] : null);
        }
        getHighestUnacknowledgedBatchId() {
            return Et.resolve(0 === this.mutationQueue.length ? -1 : this.ws - 1);
        }
        getAllMutationBatches(t) {
            return Et.resolve(this.mutationQueue.slice());
        }
        getAllMutationBatchesAffectingDocumentKey(t, e) {
            const n = new eo(e, 0), s = new eo(e, Number.POSITIVE_INFINITY), i = [];
            return this.gs.forEachInRange([ n, s ], (t => {
                const e = this.ys(t._s);
                i.push(e);
            })), Et.resolve(i);
        }
        getAllMutationBatchesAffectingDocumentKeys(t, e) {
            let n = new Ut(X);
            return e.forEach((t => {
                const e = new eo(t, 0), s = new eo(t, Number.POSITIVE_INFINITY);
                this.gs.forEachInRange([ e, s ], (t => {
                    n = n.add(t._s);
                }));
            })), Et.resolve(this.Is(n));
        }
        getAllMutationBatchesAffectingQuery(t, e) {
            // Use the query path as a prefix for testing if a document matches the
            // query.
            const n = e.path, s = n.length + 1;
            // Construct a document reference for actually scanning the index. Unlike
            // the prefix the document key in this reference must have an even number of
            // segments. The empty segment can be used a suffix of the query path
            // because it precedes all other segments in an ordered traversal.
            let i = n;
            ut.isDocumentKey(i) || (i = i.child(""));
            const r = new eo(new ut(i), 0);
            // Find unique batchIDs referenced by all documents potentially matching the
            // query.
                    let o = new Ut(X);
            return this.gs.forEachWhile((t => {
                const e = t.key.path;
                return !!n.isPrefixOf(e) && (
                // Rows with document keys more than one segment longer than the query
                // path can't be matches. For example, a query on 'rooms' can't match
                // the document /rooms/abc/messages/xyx.
                // TODO(mcg): we'll need a different scanner when we implement
                // ancestor queries.
                e.length === s && (o = o.add(t._s)), !0);
            }), r), Et.resolve(this.Is(o));
        }
        Is(t) {
            // Construct an array of matching batches, sorted by batchID to ensure that
            // multiple mutations affecting the same document key are applied in order.
            const e = [];
            return t.forEach((t => {
                const n = this.ys(t);
                null !== n && e.push(n);
            })), e;
        }
        removeMutationBatch(t, e) {
            M(0 === this.Ts(e.batchId, "removed")), this.mutationQueue.shift();
            let n = this.gs;
            return Et.forEach(e.mutations, (s => {
                const i = new eo(s.key, e.batchId);
                return n = n.delete(i), this.referenceDelegate.markPotentiallyOrphaned(t, s.key);
            })).next((() => {
                this.gs = n;
            }));
        }
        An(t) {
            // No-op since the memory mutation queue does not maintain a separate cache.
        }
        containsKey(t, e) {
            const n = new eo(e, 0), s = this.gs.firstAfterOrEqual(n);
            return Et.resolve(e.isEqual(s && s.key));
        }
        performConsistencyCheck(t) {
            return this.mutationQueue.length, Et.resolve();
        }
        /**
         * Finds the index of the given batchId in the mutation queue and asserts that
         * the resulting index is within the bounds of the queue.
         *
         * @param batchId - The batchId to search for
         * @param action - A description of what the caller is doing, phrased in passive
         * form (e.g. "acknowledged" in a routine that acknowledges batches).
         */    Ts(t, e) {
            return this.ps(t);
        }
        /**
         * Finds the index of the given batchId in the mutation queue. This operation
         * is O(1).
         *
         * @returns The computed index of the batch with the given batchId, based on
         * the state of the queue. Note this index can be negative if the requested
         * batchId has already been remvoed from the queue or past the end of the
         * queue if the batchId is larger than the last added batch.
         */    ps(t) {
            if (0 === this.mutationQueue.length) 
            // As an index this is past the end of the queue
            return 0;
            // Examine the front of the queue to figure out the difference between the
            // batchId and indexes in the array. Note that since the queue is ordered
            // by batchId, if the first batch has a larger batchId then the requested
            // batchId doesn't exist in the queue.
                    return t - this.mutationQueue[0].batchId;
        }
        /**
         * A version of lookupMutationBatch that doesn't return a promise, this makes
         * other functions that uses this code easier to read and more efficent.
         */    ys(t) {
            const e = this.ps(t);
            if (e < 0 || e >= this.mutationQueue.length) return null;
            return this.mutationQueue[e];
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * The memory-only RemoteDocumentCache for IndexedDb. To construct, invoke
     * `newMemoryRemoteDocumentCache()`.
     */
    class so {
        /**
         * @param sizer - Used to assess the size of a document. For eager GC, this is
         * expected to just return 0 to avoid unnecessarily doing the work of
         * calculating the size.
         */
        constructor(t) {
            this.Es = t, 
            /** Underlying cache of documents and their read times. */
            this.docs = new $t(ut.comparator), 
            /** Size of all cached documents. */
            this.size = 0;
        }
        setIndexManager(t) {
            this.indexManager = t;
        }
        /**
         * Adds the supplied entry to the cache and updates the cache size as appropriate.
         *
         * All calls of `addEntry`  are required to go through the RemoteDocumentChangeBuffer
         * returned by `newChangeBuffer()`.
         */    addEntry(t, e) {
            const n = e.key, s = this.docs.get(n), i = s ? s.size : 0, r = this.Es(e);
            return this.docs = this.docs.insert(n, {
                document: e.mutableCopy(),
                size: r
            }), this.size += r - i, this.indexManager.addToCollectionParentIndex(t, n.path.popLast());
        }
        /**
         * Removes the specified entry from the cache and updates the cache size as appropriate.
         *
         * All calls of `removeEntry` are required to go through the RemoteDocumentChangeBuffer
         * returned by `newChangeBuffer()`.
         */    removeEntry(t) {
            const e = this.docs.get(t);
            e && (this.docs = this.docs.remove(t), this.size -= e.size);
        }
        getEntry(t, e) {
            const n = this.docs.get(e);
            return Et.resolve(n ? n.document.mutableCopy() : Ve.newInvalidDocument(e));
        }
        getEntries(t, e) {
            let n = ns();
            return e.forEach((t => {
                const e = this.docs.get(t);
                n = n.insert(t, e ? e.document.mutableCopy() : Ve.newInvalidDocument(t));
            })), Et.resolve(n);
        }
        getAllFromCollection(t, e, n) {
            let s = ns();
            // Documents are ordered by key, so we can use a prefix scan to narrow down
            // the documents we need to match the query against.
                    const i = new ut(e.child("")), r = this.docs.getIteratorFrom(i);
            for (;r.hasNext(); ) {
                const {key: t, value: {document: i}} = r.getNext();
                if (!e.isPrefixOf(t.path)) break;
                t.path.length > e.length + 1 || (yt(mt(i), n) <= 0 || (s = s.insert(i.key, i.mutableCopy())));
            }
            return Et.resolve(s);
        }
        getAllFromCollectionGroup(t, e, n, s) {
            // This method should only be called from the IndexBackfiller if persistence
            // is enabled.
            k();
        }
        As(t, e) {
            return Et.forEach(this.docs, (t => e(t)));
        }
        newChangeBuffer(t) {
            // `trackRemovals` is ignores since the MemoryRemoteDocumentCache keeps
            // a separate changelog and does not need special handling for removals.
            return new io(this);
        }
        getSize(t) {
            return Et.resolve(this.size);
        }
    }

    /**
     * Creates a new memory-only RemoteDocumentCache.
     *
     * @param sizer - Used to assess the size of a document. For eager GC, this is
     * expected to just return 0 to avoid unnecessarily doing the work of
     * calculating the size.
     */
    /**
     * Handles the details of adding and updating documents in the MemoryRemoteDocumentCache.
     */
    class io extends Ur {
        constructor(t) {
            super(), this.Yn = t;
        }
        applyChanges(t) {
            const e = [];
            return this.changes.forEach(((n, s) => {
                s.isValidDocument() ? e.push(this.Yn.addEntry(t, s)) : this.Yn.removeEntry(n);
            })), Et.waitFor(e);
        }
        getFromCache(t, e) {
            return this.Yn.getEntry(t, e);
        }
        getAllFromCache(t, e) {
            return this.Yn.getEntries(t, e);
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */ class ro {
        constructor(t) {
            this.persistence = t, 
            /**
             * Maps a target to the data about that target
             */
            this.Rs = new ts((t => Ce(t)), Ne), 
            /** The last received snapshot version. */
            this.lastRemoteSnapshotVersion = nt.min(), 
            /** The highest numbered target ID encountered. */
            this.highestTargetId = 0, 
            /** The highest sequence number encountered. */
            this.bs = 0, 
            /**
             * A ordered bidirectional mapping between documents and the remote target
             * IDs.
             */
            this.Ps = new to, this.targetCount = 0, this.vs = Dr.Pn();
        }
        forEachTarget(t, e) {
            return this.Rs.forEach(((t, n) => e(n))), Et.resolve();
        }
        getLastRemoteSnapshotVersion(t) {
            return Et.resolve(this.lastRemoteSnapshotVersion);
        }
        getHighestSequenceNumber(t) {
            return Et.resolve(this.bs);
        }
        allocateTargetId(t) {
            return this.highestTargetId = this.vs.next(), Et.resolve(this.highestTargetId);
        }
        setTargetsMetadata(t, e, n) {
            return n && (this.lastRemoteSnapshotVersion = n), e > this.bs && (this.bs = e), 
            Et.resolve();
        }
        Dn(t) {
            this.Rs.set(t.target, t);
            const e = t.targetId;
            e > this.highestTargetId && (this.vs = new Dr(e), this.highestTargetId = e), t.sequenceNumber > this.bs && (this.bs = t.sequenceNumber);
        }
        addTargetData(t, e) {
            return this.Dn(e), this.targetCount += 1, Et.resolve();
        }
        updateTargetData(t, e) {
            return this.Dn(e), Et.resolve();
        }
        removeTargetData(t, e) {
            return this.Rs.delete(e.target), this.Ps.ls(e.targetId), this.targetCount -= 1, 
            Et.resolve();
        }
        removeTargets(t, e, n) {
            let s = 0;
            const i = [];
            return this.Rs.forEach(((r, o) => {
                o.sequenceNumber <= e && null === n.get(o.targetId) && (this.Rs.delete(r), i.push(this.removeMatchingKeysForTargetId(t, o.targetId)), 
                s++);
            })), Et.waitFor(i).next((() => s));
        }
        getTargetCount(t) {
            return Et.resolve(this.targetCount);
        }
        getTargetData(t, e) {
            const n = this.Rs.get(e) || null;
            return Et.resolve(n);
        }
        addMatchingKeys(t, e, n) {
            return this.Ps.us(e, n), Et.resolve();
        }
        removeMatchingKeys(t, e, n) {
            this.Ps.hs(e, n);
            const s = this.persistence.referenceDelegate, i = [];
            return s && e.forEach((e => {
                i.push(s.markPotentiallyOrphaned(t, e));
            })), Et.waitFor(i);
        }
        removeMatchingKeysForTargetId(t, e) {
            return this.Ps.ls(e), Et.resolve();
        }
        getMatchingKeysForTargetId(t, e) {
            const n = this.Ps.ds(e);
            return Et.resolve(n);
        }
        containsKey(t, e) {
            return Et.resolve(this.Ps.containsKey(e));
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * A memory-backed instance of Persistence. Data is stored only in RAM and
     * not persisted across sessions.
     */
    class oo {
        /**
         * The constructor accepts a factory for creating a reference delegate. This
         * allows both the delegate and this instance to have strong references to
         * each other without having nullable fields that would then need to be
         * checked or asserted on every access.
         */
        constructor(t, e) {
            this.Vs = {}, this.overlays = {}, this.Ss = new kt(0), this.Ds = !1, this.Ds = !0, 
            this.referenceDelegate = t(this), this.Cs = new ro(this);
            this.indexManager = new fr, this.remoteDocumentCache = function(t) {
                return new so(t);
            }((t => this.referenceDelegate.xs(t))), this.It = new Fi(e), this.Ns = new Xr(this.It);
        }
        start() {
            return Promise.resolve();
        }
        shutdown() {
            // No durable state to ensure is closed on shutdown.
            return this.Ds = !1, Promise.resolve();
        }
        get started() {
            return this.Ds;
        }
        setDatabaseDeletedListener() {
            // No op.
        }
        setNetworkEnabled() {
            // No op.
        }
        getIndexManager(t) {
            // We do not currently support indices for memory persistence, so we can
            // return the same shared instance of the memory index manager.
            return this.indexManager;
        }
        getDocumentOverlayCache(t) {
            let e = this.overlays[t.toKey()];
            return e || (e = new Zr, this.overlays[t.toKey()] = e), e;
        }
        getMutationQueue(t, e) {
            let n = this.Vs[t.toKey()];
            return n || (n = new no(e, this.referenceDelegate), this.Vs[t.toKey()] = n), n;
        }
        getTargetCache() {
            return this.Cs;
        }
        getRemoteDocumentCache() {
            return this.remoteDocumentCache;
        }
        getBundleCache() {
            return this.Ns;
        }
        runTransaction(t, e, n) {
            D("MemoryPersistence", "Starting transaction:", t);
            const s = new uo(this.Ss.next());
            return this.referenceDelegate.ks(), n(s).next((t => this.referenceDelegate.Ms(s).next((() => t)))).toPromise().then((t => (s.raiseOnCommittedEvent(), 
            t)));
        }
        Os(t, e) {
            return Et.or(Object.values(this.Vs).map((n => () => n.containsKey(t, e))));
        }
    }

    /**
     * Memory persistence is not actually transactional, but future implementations
     * may have transaction-scoped state.
     */ class uo extends It {
        constructor(t) {
            super(), this.currentSequenceNumber = t;
        }
    }

    class co {
        constructor(t) {
            this.persistence = t, 
            /** Tracks all documents that are active in Query views. */
            this.Fs = new to, 
            /** The list of documents that are potentially GCed after each transaction. */
            this.$s = null;
        }
        static Bs(t) {
            return new co(t);
        }
        get Ls() {
            if (this.$s) return this.$s;
            throw k();
        }
        addReference(t, e, n) {
            return this.Fs.addReference(n, e), this.Ls.delete(n.toString()), Et.resolve();
        }
        removeReference(t, e, n) {
            return this.Fs.removeReference(n, e), this.Ls.add(n.toString()), Et.resolve();
        }
        markPotentiallyOrphaned(t, e) {
            return this.Ls.add(e.toString()), Et.resolve();
        }
        removeTarget(t, e) {
            this.Fs.ls(e.targetId).forEach((t => this.Ls.add(t.toString())));
            const n = this.persistence.getTargetCache();
            return n.getMatchingKeysForTargetId(t, e.targetId).next((t => {
                t.forEach((t => this.Ls.add(t.toString())));
            })).next((() => n.removeTargetData(t, e)));
        }
        ks() {
            this.$s = new Set;
        }
        Ms(t) {
            // Remove newly orphaned documents.
            const e = this.persistence.getRemoteDocumentCache().newChangeBuffer();
            return Et.forEach(this.Ls, (n => {
                const s = ut.fromPath(n);
                return this.Us(t, s).next((t => {
                    t || e.removeEntry(s, nt.min());
                }));
            })).next((() => (this.$s = null, e.apply(t))));
        }
        updateLimboDocument(t, e) {
            return this.Us(t, e).next((t => {
                t ? this.Ls.delete(e.toString()) : this.Ls.add(e.toString());
            }));
        }
        xs(t) {
            // For eager GC, we don't care about the document size, there are no size thresholds.
            return 0;
        }
        Us(t, e) {
            return Et.or([ () => Et.resolve(this.Fs.containsKey(e)), () => this.persistence.getTargetCache().containsKey(t, e), () => this.persistence.Os(t, e) ]);
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * A set of changes to what documents are currently in view and out of view for
     * a given query. These changes are sent to the LocalStore by the View (via
     * the SyncEngine) and are used to pin / unpin documents as appropriate.
     */
    class go {
        constructor(t, e, n, s) {
            this.targetId = t, this.fromCache = e, this.Si = n, this.Di = s;
        }
        static Ci(t, e) {
            let n = ls(), s = ls();
            for (const t of e.docChanges) switch (t.type) {
              case 0 /* Added */ :
                n = n.add(t.doc.key);
                break;

              case 1 /* Removed */ :
                s = s.add(t.doc.key);
     // do nothing
                    }
            return new go(t, e.fromCache, n, s);
        }
    }

    /**
     * @license
     * Copyright 2019 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * The Firestore query engine.
     *
     * Firestore queries can be executed in three modes. The Query Engine determines
     * what mode to use based on what data is persisted. The mode only determines
     * the runtime complexity of the query - the result set is equivalent across all
     * implementations.
     *
     * The Query engine will use indexed-based execution if a user has configured
     * any index that can be used to execute query (via `setIndexConfiguration()`).
     * Otherwise, the engine will try to optimize the query by re-using a previously
     * persisted query result. If that is not possible, the query will be executed
     * via a full collection scan.
     *
     * Index-based execution is the default when available. The query engine
     * supports partial indexed execution and merges the result from the index
     * lookup with documents that have not yet been indexed. The index evaluation
     * matches the backend's format and as such, the SDK can use indexing for all
     * queries that the backend supports.
     *
     * If no index exists, the query engine tries to take advantage of the target
     * document mapping in the TargetCache. These mappings exists for all queries
     * that have been synced with the backend at least once and allow the query
     * engine to only read documents that previously matched a query plus any
     * documents that were edited after the query was last listened to.
     *
     * There are some cases when this optimization is not guaranteed to produce
     * the same results as full collection scans. In these cases, query
     * processing falls back to full scans. These cases are:
     *
     * - Limit queries where a document that matched the query previously no longer
     *   matches the query.
     *
     * - Limit queries where a document edit may cause the document to sort below
     *   another document that is in the local cache.
     *
     * - Queries that have never been CURRENT or free of limbo documents.
     */ class yo {
        constructor() {
            this.xi = !1;
        }
        /** Sets the document view to query against. */    initialize(t, e) {
            this.Ni = t, this.indexManager = e, this.xi = !0;
        }
        /** Returns all local documents matching the specified query. */    getDocumentsMatchingQuery(t, e, n, s) {
            return this.ki(t, e).next((i => i || this.Mi(t, e, s, n))).next((n => n || this.Oi(t, e)));
        }
        /**
         * Performs an indexed query that evaluates the query based on a collection's
         * persisted index values. Returns `null` if an index is not available.
         */    ki(t, e) {
            if (en(e)) 
            // Queries that match all documents don't benefit from using
            // key-based lookups. It is more efficient to scan all documents in a
            // collection, rather than to perform individual lookups.
            return Et.resolve(null);
            let n = un(e);
            return this.indexManager.getIndexType(t, n).next((s => 0 /* NONE */ === s ? null : (null !== e.limit && 1 /* PARTIAL */ === s && (
            // We cannot apply a limit for targets that are served using a partial
            // index. If a partial index will be used to serve the target, the
            // query may return a superset of documents that match the target
            // (e.g. if the index doesn't include all the target's filters), or
            // may return the correct set of documents in the wrong order (e.g. if
            // the index doesn't include a segment for one of the orderBys).
            // Therefore, a limit should not be applied in such cases.
            e = cn(e, null, "F" /* First */), n = un(e)), this.indexManager.getDocumentsMatchingTarget(t, n).next((s => {
                const i = ls(...s);
                return this.Ni.getDocuments(t, i).next((s => this.indexManager.getMinOffset(t, n).next((n => {
                    const r = this.Fi(e, s);
                    return this.$i(e, r, i, n.readTime) ? this.ki(t, cn(e, null, "F" /* First */)) : this.Bi(t, r, e, n);
                }))));
            })))));
        }
        /**
         * Performs a query based on the target's persisted query mapping. Returns
         * `null` if the mapping is not available or cannot be used.
         */    Mi(t, e, n, s) {
            return en(e) || s.isEqual(nt.min()) ? this.Oi(t, e) : this.Ni.getDocuments(t, n).next((i => {
                const r = this.Fi(e, i);
                return this.$i(e, r, n, s) ? this.Oi(t, e) : (V() <= LogLevel.DEBUG && D("QueryEngine", "Re-using previous result from %s to execute query: %s", s.toString(), ln(e)), 
                this.Bi(t, r, e, wt(s, -1)));
            }));
            // Queries that have never seen a snapshot without limbo free documents
            // should also be run as a full collection scan.
            }
        /** Applies the query filter and sorting to the provided documents.  */    Fi(t, e) {
            // Sort the documents and re-apply the query filter since previously
            // matching documents do not necessarily still match the query.
            let n = new Ut(_n(t));
            return e.forEach(((e, s) => {
                fn(t, s) && (n = n.add(s));
            })), n;
        }
        /**
         * Determines if a limit query needs to be refilled from cache, making it
         * ineligible for index-free execution.
         *
         * @param query - The query.
         * @param sortedPreviousResults - The documents that matched the query when it
         * was last synchronized, sorted by the query's comparator.
         * @param remoteKeys - The document keys that matched the query at the last
         * snapshot.
         * @param limboFreeSnapshotVersion - The version of the snapshot when the
         * query was last synchronized.
         */    $i(t, e, n, s) {
            if (null === t.limit) 
            // Queries without limits do not need to be refilled.
            return !1;
            if (n.size !== e.size) 
            // The query needs to be refilled if a previously matching document no
            // longer matches.
            return !0;
            // Limit queries are not eligible for index-free query execution if there is
            // a potential that an older document from cache now sorts before a document
            // that was previously part of the limit. This, however, can only happen if
            // the document at the edge of the limit goes out of limit.
            // If a document that is not the limit boundary sorts differently,
            // the boundary of the limit itself did not change and documents from cache
            // will continue to be "rejected" by this boundary. Therefore, we can ignore
            // any modifications that don't affect the last document.
                    const i = "F" /* First */ === t.limitType ? e.last() : e.first();
            return !!i && (i.hasPendingWrites || i.version.compareTo(s) > 0);
        }
        Oi(t, e) {
            return V() <= LogLevel.DEBUG && D("QueryEngine", "Using full collection scan to execute query:", ln(e)), 
            this.Ni.getDocumentsMatchingQuery(t, e, gt.min());
        }
        /**
         * Combines the results from an indexed execution with the remaining documents
         * that have not yet been indexed.
         */    Bi(t, e, n, s) {
            // Retrieve all results for documents that were updated since the offset.
            return this.Ni.getDocumentsMatchingQuery(t, n, s).next((t => (
            // Merge with existing results
            e.forEach((e => {
                t = t.insert(e.key, e);
            })), t)));
        }
    }

    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Implements `LocalStore` interface.
     *
     * Note: some field defined in this class might have public access level, but
     * the class is not exported so they are only accessible from this module.
     * This is useful to implement optional features (like bundles) in free
     * functions, such that they are tree-shakeable.
     */
    class po {
        constructor(
        /** Manages our in-memory or durable persistence. */
        t, e, n, s) {
            this.persistence = t, this.Li = e, this.It = s, 
            /**
             * Maps a targetID to data about its target.
             *
             * PORTING NOTE: We are using an immutable data structure on Web to make re-runs
             * of `applyRemoteEvent()` idempotent.
             */
            this.Ui = new $t(X), 
            /** Maps a target to its targetID. */
            // TODO(wuandy): Evaluate if TargetId can be part of Target.
            this.qi = new ts((t => Ce(t)), Ne), 
            /**
             * A per collection group index of the last read time processed by
             * `getNewDocumentChanges()`.
             *
             * PORTING NOTE: This is only used for multi-tab synchronization.
             */
            this.Ki = new Map, this.Gi = t.getRemoteDocumentCache(), this.Cs = t.getTargetCache(), 
            this.Ns = t.getBundleCache(), this.Qi(n);
        }
        Qi(t) {
            // TODO(indexing): Add spec tests that test these components change after a
            // user change
            this.documentOverlayCache = this.persistence.getDocumentOverlayCache(t), this.indexManager = this.persistence.getIndexManager(t), 
            this.mutationQueue = this.persistence.getMutationQueue(t, this.indexManager), this.localDocuments = new Yr(this.Gi, this.mutationQueue, this.documentOverlayCache, this.indexManager), 
            this.Gi.setIndexManager(this.indexManager), this.Li.initialize(this.localDocuments, this.indexManager);
        }
        collectGarbage(t) {
            return this.persistence.runTransaction("Collect garbage", "readwrite-primary", (e => t.collect(e, this.Ui)));
        }
    }

    function Io(
    /** Manages our in-memory or durable persistence. */
    t, e, n, s) {
        return new po(t, e, n, s);
    }

    /**
     * Tells the LocalStore that the currently authenticated user has changed.
     *
     * In response the local store switches the mutation queue to the new user and
     * returns any resulting document changes.
     */
    // PORTING NOTE: Android and iOS only return the documents affected by the
    // change.
    async function To(t, e) {
        const n = F(t);
        return await n.persistence.runTransaction("Handle user change", "readonly", (t => {
            // Swap out the mutation queue, grabbing the pending mutation batches
            // before and after.
            let s;
            return n.mutationQueue.getAllMutationBatches(t).next((i => (s = i, n.Qi(e), n.mutationQueue.getAllMutationBatches(t)))).next((e => {
                const i = [], r = [];
                // Union the old/new changed keys.
                let o = ls();
                for (const t of s) {
                    i.push(t.batchId);
                    for (const e of t.mutations) o = o.add(e.key);
                }
                for (const t of e) {
                    r.push(t.batchId);
                    for (const e of t.mutations) o = o.add(e.key);
                }
                // Return the set of all (potentially) changed documents and the list
                // of mutation batch IDs that were affected by change.
                            return n.localDocuments.getDocuments(t, o).next((t => ({
                    ji: t,
                    removedBatchIds: i,
                    addedBatchIds: r
                })));
            }));
        }));
    }

    /* Accepts locally generated Mutations and commit them to storage. */
    /**
     * Acknowledges the given batch.
     *
     * On the happy path when a batch is acknowledged, the local store will
     *
     *  + remove the batch from the mutation queue;
     *  + apply the changes to the remote document cache;
     *  + recalculate the latency compensated view implied by those changes (there
     *    may be mutations in the queue that affect the documents but haven't been
     *    acknowledged yet); and
     *  + give the changed documents back the sync engine
     *
     * @returns The resulting (modified) documents.
     */
    function Eo(t, e) {
        const n = F(t);
        return n.persistence.runTransaction("Acknowledge batch", "readwrite-primary", (t => {
            const s = e.batch.keys(), i = n.Gi.newChangeBuffer({
                trackRemovals: !0
            });
            return function(t, e, n, s) {
                const i = n.batch, r = i.keys();
                let o = Et.resolve();
                return r.forEach((t => {
                    o = o.next((() => s.getEntry(e, t))).next((e => {
                        const r = n.docVersions.get(t);
                        M(null !== r), e.version.compareTo(r) < 0 && (i.applyToRemoteDocument(e, n), e.isValidDocument() && (
                        // We use the commitVersion as the readTime rather than the
                        // document's updateTime since the updateTime is not advanced
                        // for updates that do not modify the underlying document.
                        e.setReadTime(n.commitVersion), s.addEntry(e)));
                    }));
                })), o.next((() => t.mutationQueue.removeMutationBatch(e, i)));
            }
            /** Returns the local view of the documents affected by a mutation batch. */
            // PORTING NOTE: Multi-Tab only.
            (n, t, e, i).next((() => i.apply(t))).next((() => n.mutationQueue.performConsistencyCheck(t))).next((() => n.documentOverlayCache.removeOverlaysForBatchId(t, s, e.batch.batchId))).next((() => n.localDocuments.recalculateAndSaveOverlaysForDocumentKeys(t, function(t) {
                let e = ls();
                for (let n = 0; n < t.mutationResults.length; ++n) {
                    t.mutationResults[n].transformResults.length > 0 && (e = e.add(t.batch.mutations[n].key));
                }
                return e;
            }
            /**
     * Removes mutations from the MutationQueue for the specified batch;
     * LocalDocuments will be recalculated.
     *
     * @returns The resulting modified documents.
     */ (e)))).next((() => n.localDocuments.getDocuments(t, s)));
        }));
    }

    /**
     * Returns the last consistent snapshot processed (used by the RemoteStore to
     * determine whether to buffer incoming snapshots from the backend).
     */
    function Ao(t) {
        const e = F(t);
        return e.persistence.runTransaction("Get last remote snapshot version", "readonly", (t => e.Cs.getLastRemoteSnapshotVersion(t)));
    }

    /**
     * Updates the "ground-state" (remote) documents. We assume that the remote
     * event reflects any write batches that have been acknowledged or rejected
     * (i.e. we do not re-apply local mutations to updates from this event).
     *
     * LocalDocuments are re-calculated if there are remaining mutations in the
     * queue.
     */ function Ro(t, e) {
        const n = F(t), s = e.snapshotVersion;
        let i = n.Ui;
        return n.persistence.runTransaction("Apply remote event", "readwrite-primary", (t => {
            const r = n.Gi.newChangeBuffer({
                trackRemovals: !0
            });
            // Reset newTargetDataByTargetMap in case this transaction gets re-run.
                    i = n.Ui;
            const o = [];
            e.targetChanges.forEach(((r, u) => {
                const c = i.get(u);
                if (!c) return;
                // Only update the remote keys if the target is still active. This
                // ensures that we can persist the updated target data along with
                // the updated assignment.
                            o.push(n.Cs.removeMatchingKeys(t, r.removedDocuments, u).next((() => n.Cs.addMatchingKeys(t, r.addedDocuments, u))));
                let a = c.withSequenceNumber(t.currentSequenceNumber);
                e.targetMismatches.has(u) ? a = a.withResumeToken(jt.EMPTY_BYTE_STRING, nt.min()).withLastLimboFreeSnapshotVersion(nt.min()) : r.resumeToken.approximateByteSize() > 0 && (a = a.withResumeToken(r.resumeToken, s)), 
                i = i.insert(u, a), 
                // Update the target data if there are target changes (or if
                // sufficient time has passed since the last update).
                /**
     * Returns true if the newTargetData should be persisted during an update of
     * an active target. TargetData should always be persisted when a target is
     * being released and should not call this function.
     *
     * While the target is active, TargetData updates can be omitted when nothing
     * about the target has changed except metadata like the resume token or
     * snapshot version. Occasionally it's worth the extra write to prevent these
     * values from getting too stale after a crash, but this doesn't have to be
     * too frequent.
     */
                function(t, e, n) {
                    // Always persist target data if we don't already have a resume token.
                    if (0 === t.resumeToken.approximateByteSize()) return !0;
                    // Don't allow resume token changes to be buffered indefinitely. This
                    // allows us to be reasonably up-to-date after a crash and avoids needing
                    // to loop over all active queries on shutdown. Especially in the browser
                    // we may not get time to do anything interesting while the current tab is
                    // closing.
                                    if (e.snapshotVersion.toMicroseconds() - t.snapshotVersion.toMicroseconds() >= 3e8) return !0;
                    // Otherwise if the only thing that has changed about a target is its resume
                    // token it's not worth persisting. Note that the RemoteStore keeps an
                    // in-memory view of the currently active targets which includes the current
                    // resume token, so stream failure or user changes will still use an
                    // up-to-date resume token regardless of what we do here.
                                    return n.addedDocuments.size + n.modifiedDocuments.size + n.removedDocuments.size > 0;
                }
                /**
     * Notifies local store of the changed views to locally pin documents.
     */ (c, a, r) && o.push(n.Cs.updateTargetData(t, a));
            }));
            let u = ns(), c = ls();
            // HACK: The only reason we allow a null snapshot version is so that we
            // can synthesize remote events when we get permission denied errors while
            // trying to resolve the state of a locally cached document that is in
            // limbo.
            if (e.documentUpdates.forEach((s => {
                e.resolvedLimboDocuments.has(s) && o.push(n.persistence.referenceDelegate.updateLimboDocument(t, s));
            })), 
            // Each loop iteration only affects its "own" doc, so it's safe to get all
            // the remote documents in advance in a single call.
            o.push(bo(t, r, e.documentUpdates).next((t => {
                u = t.Wi, c = t.zi;
            }))), !s.isEqual(nt.min())) {
                const e = n.Cs.getLastRemoteSnapshotVersion(t).next((e => n.Cs.setTargetsMetadata(t, t.currentSequenceNumber, s)));
                o.push(e);
            }
            return Et.waitFor(o).next((() => r.apply(t))).next((() => n.localDocuments.getLocalViewOfDocuments(t, u, c))).next((() => u));
        })).then((t => (n.Ui = i, t)));
    }

    /**
     * Populates document change buffer with documents from backend or a bundle.
     * Returns the document changes resulting from applying those documents, and
     * also a set of documents whose existence state are changed as a result.
     *
     * @param txn - Transaction to use to read existing documents from storage.
     * @param documentBuffer - Document buffer to collect the resulted changes to be
     *        applied to storage.
     * @param documents - Documents to be applied.
     */ function bo(t, e, n) {
        let s = ls(), i = ls();
        return n.forEach((t => s = s.add(t))), e.getEntries(t, s).next((t => {
            let s = ns();
            return n.forEach(((n, r) => {
                const o = t.get(n);
                // Check if see if there is a existence state change for this document.
                            r.isFoundDocument() !== o.isFoundDocument() && (i = i.add(n)), 
                // Note: The order of the steps below is important, since we want
                // to ensure that rejected limbo resolutions (which fabricate
                // NoDocuments with SnapshotVersion.min()) never add documents to
                // cache.
                r.isNoDocument() && r.version.isEqual(nt.min()) ? (
                // NoDocuments with SnapshotVersion.min() are used in manufactured
                // events. We remove these documents from cache since we lost
                // access.
                e.removeEntry(n, r.readTime), s = s.insert(n, r)) : !o.isValidDocument() || r.version.compareTo(o.version) > 0 || 0 === r.version.compareTo(o.version) && o.hasPendingWrites ? (e.addEntry(r), 
                s = s.insert(n, r)) : D("LocalStore", "Ignoring outdated watch update for ", n, ". Current version:", o.version, " Watch version:", r.version);
            })), {
                Wi: s,
                zi: i
            };
        }));
    }

    /**
     * Gets the mutation batch after the passed in batchId in the mutation queue
     * or null if empty.
     * @param afterBatchId - If provided, the batch to search after.
     * @returns The next mutation or null if there wasn't one.
     */
    function Po(t, e) {
        const n = F(t);
        return n.persistence.runTransaction("Get next mutation batch", "readonly", (t => (void 0 === e && (e = -1), 
        n.mutationQueue.getNextMutationBatchAfterBatchId(t, e))));
    }

    /**
     * Reads the current value of a Document with a given key or null if not
     * found - used for testing.
     */
    /**
     * Assigns the given target an internal ID so that its results can be pinned so
     * they don't get GC'd. A target must be allocated in the local store before
     * the store can be used to manage its view.
     *
     * Allocating an already allocated `Target` will return the existing `TargetData`
     * for that `Target`.
     */
    function vo(t, e) {
        const n = F(t);
        return n.persistence.runTransaction("Allocate target", "readwrite", (t => {
            let s;
            return n.Cs.getTargetData(t, e).next((i => i ? (
            // This target has been listened to previously, so reuse the
            // previous targetID.
            // TODO(mcg): freshen last accessed date?
            s = i, Et.resolve(s)) : n.Cs.allocateTargetId(t).next((i => (s = new Oi(e, i, 0 /* Listen */ , t.currentSequenceNumber), 
            n.Cs.addTargetData(t, s).next((() => s)))))));
        })).then((t => {
            // If Multi-Tab is enabled, the existing target data may be newer than
            // the in-memory data
            const s = n.Ui.get(t.targetId);
            return (null === s || t.snapshotVersion.compareTo(s.snapshotVersion) > 0) && (n.Ui = n.Ui.insert(t.targetId, t), 
            n.qi.set(e, t.targetId)), t;
        }));
    }

    /**
     * Returns the TargetData as seen by the LocalStore, including updates that may
     * have not yet been persisted to the TargetCache.
     */
    // Visible for testing.
    /**
     * Unpins all the documents associated with the given target. If
     * `keepPersistedTargetData` is set to false and Eager GC enabled, the method
     * directly removes the associated target data from the target cache.
     *
     * Releasing a non-existing `Target` is a no-op.
     */
    // PORTING NOTE: `keepPersistedTargetData` is multi-tab only.
    async function Vo(t, e, n) {
        const s = F(t), i = s.Ui.get(e), r = n ? "readwrite" : "readwrite-primary";
        try {
            n || await s.persistence.runTransaction("Release target", r, (t => s.persistence.referenceDelegate.removeTarget(t, i)));
        } catch (t) {
            if (!vt(t)) throw t;
            // All `releaseTarget` does is record the final metadata state for the
            // target, but we've been recording this periodically during target
            // activity. If we lose this write this could cause a very slight
            // difference in the order of target deletion during GC, but we
            // don't define exact LRU semantics so this is acceptable.
            D("LocalStore", `Failed to update sequence numbers for target ${e}: ${t}`);
        }
        s.Ui = s.Ui.remove(e), s.qi.delete(i.target);
    }

    /**
     * Runs the specified query against the local store and returns the results,
     * potentially taking advantage of query data from previous executions (such
     * as the set of remote keys).
     *
     * @param usePreviousResults - Whether results from previous executions can
     * be used to optimize this query execution.
     */ function So(t, e, n) {
        const s = F(t);
        let i = nt.min(), r = ls();
        return s.persistence.runTransaction("Execute query", "readonly", (t => function(t, e, n) {
            const s = F(t), i = s.qi.get(n);
            return void 0 !== i ? Et.resolve(s.Ui.get(i)) : s.Cs.getTargetData(e, n);
        }(s, t, un(e)).next((e => {
            if (e) return i = e.lastLimboFreeSnapshotVersion, s.Cs.getMatchingKeysForTargetId(t, e.targetId).next((t => {
                r = t;
            }));
        })).next((() => s.Li.getDocumentsMatchingQuery(t, e, n ? i : nt.min(), n ? r : ls()))).next((t => (xo(s, dn(e), t), 
        {
            documents: t,
            Hi: r
        })))));
    }

    /** Sets the collection group's maximum read time from the given documents. */
    // PORTING NOTE: Multi-Tab only.
    function xo(t, e, n) {
        let s = nt.min();
        n.forEach(((t, e) => {
            e.readTime.compareTo(s) > 0 && (s = e.readTime);
        })), t.Ki.set(e, s);
    }

    /**
     * Metadata state of the local client. Unlike `RemoteClientState`, this class is
     * mutable and keeps track of all pending mutations, which allows us to
     * update the range of pending mutation batch IDs as new mutations are added or
     * removed.
     *
     * The data in `LocalClientState` is not read from WebStorage and instead
     * updated via its instance methods. The updated state can be serialized via
     * `toWebStorageJSON()`.
     */
    // Visible for testing.
    class qo {
        constructor() {
            this.activeTargetIds = ds();
        }
        er(t) {
            this.activeTargetIds = this.activeTargetIds.add(t);
        }
        nr(t) {
            this.activeTargetIds = this.activeTargetIds.delete(t);
        }
        /**
         * Converts this entry into a JSON-encoded format we can use for WebStorage.
         * Does not encode `clientId` as it is part of the key in WebStorage.
         */    tr() {
            const t = {
                activeTargetIds: this.activeTargetIds.toArray(),
                updateTimeMs: Date.now()
            };
            return JSON.stringify(t);
        }
    }

    class Go {
        constructor() {
            this.Lr = new qo, this.Ur = {}, this.onlineStateHandler = null, this.sequenceNumberHandler = null;
        }
        addPendingMutation(t) {
            // No op.
        }
        updateMutationState(t, e, n) {
            // No op.
        }
        addLocalQueryTarget(t) {
            return this.Lr.er(t), this.Ur[t] || "not-current";
        }
        updateQueryState(t, e, n) {
            this.Ur[t] = e;
        }
        removeLocalQueryTarget(t) {
            this.Lr.nr(t);
        }
        isLocalQueryTarget(t) {
            return this.Lr.activeTargetIds.has(t);
        }
        clearQueryState(t) {
            delete this.Ur[t];
        }
        getAllActiveQueryTargets() {
            return this.Lr.activeTargetIds;
        }
        isActiveQueryTarget(t) {
            return this.Lr.activeTargetIds.has(t);
        }
        start() {
            return this.Lr = new qo, Promise.resolve();
        }
        handleUserChange(t, e, n) {
            // No op.
        }
        setOnlineState(t) {
            // No op.
        }
        shutdown() {}
        writeSequenceNumber(t) {}
        notifyBundleLoaded(t) {
            // No op.
        }
    }

    /**
     * @license
     * Copyright 2019 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */ class Qo {
        qr(t) {
            // No-op.
        }
        shutdown() {
            // No-op.
        }
    }

    /**
     * @license
     * Copyright 2019 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    // References to `window` are guarded by BrowserConnectivityMonitor.isAvailable()
    /* eslint-disable no-restricted-globals */
    /**
     * Browser implementation of ConnectivityMonitor.
     */
    class jo {
        constructor() {
            this.Kr = () => this.Gr(), this.Qr = () => this.jr(), this.Wr = [], this.zr();
        }
        qr(t) {
            this.Wr.push(t);
        }
        shutdown() {
            window.removeEventListener("online", this.Kr), window.removeEventListener("offline", this.Qr);
        }
        zr() {
            window.addEventListener("online", this.Kr), window.addEventListener("offline", this.Qr);
        }
        Gr() {
            D("ConnectivityMonitor", "Network connectivity changed: AVAILABLE");
            for (const t of this.Wr) t(0 /* AVAILABLE */);
        }
        jr() {
            D("ConnectivityMonitor", "Network connectivity changed: UNAVAILABLE");
            for (const t of this.Wr) t(1 /* UNAVAILABLE */);
        }
        // TODO(chenbrian): Consider passing in window either into this component or
        // here for testing via FakeWindow.
        /** Checks that all used attributes of window are available. */
        static C() {
            return "undefined" != typeof window && void 0 !== window.addEventListener && void 0 !== window.removeEventListener;
        }
    }

    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */ const Wo = {
        BatchGetDocuments: "batchGet",
        Commit: "commit",
        RunQuery: "runQuery"
    };

    /**
     * Maps RPC names to the corresponding REST endpoint name.
     *
     * We use array notation to avoid mangling.
     */
    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Provides a simple helper class that implements the Stream interface to
     * bridge to other implementations that are streams but do not implement the
     * interface. The stream callbacks are invoked with the callOn... methods.
     */
    class zo {
        constructor(t) {
            this.Hr = t.Hr, this.Jr = t.Jr;
        }
        Yr(t) {
            this.Xr = t;
        }
        Zr(t) {
            this.eo = t;
        }
        onMessage(t) {
            this.no = t;
        }
        close() {
            this.Jr();
        }
        send(t) {
            this.Hr(t);
        }
        so() {
            this.Xr();
        }
        io(t) {
            this.eo(t);
        }
        ro(t) {
            this.no(t);
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */ class Ho extends 
    /**
     * Base class for all Rest-based connections to the backend (WebChannel and
     * HTTP).
     */
    class {
        constructor(t) {
            this.databaseInfo = t, this.databaseId = t.databaseId;
            const e = t.ssl ? "https" : "http";
            this.oo = e + "://" + t.host, this.uo = "projects/" + this.databaseId.projectId + "/databases/" + this.databaseId.database + "/documents";
        }
        co(t, e, n, s, i) {
            const r = this.ao(t, e);
            D("RestConnection", "Sending: ", r, n);
            const o = {};
            return this.ho(o, s, i), this.lo(t, r, o, n).then((t => (D("RestConnection", "Received: ", t), 
            t)), (e => {
                throw x("RestConnection", `${t} failed with error: `, e, "url: ", r, "request:", n), 
                e;
            }));
        }
        fo(t, e, n, s, i, r) {
            // The REST API automatically aggregates all of the streamed results, so we
            // can just use the normal invoke() method.
            return this.co(t, e, n, s, i);
        }
        /**
         * Modifies the headers for a request, adding any authorization token if
         * present and any additional headers for the request.
         */    ho(t, e, n) {
            t["X-Goog-Api-Client"] = "gl-js/ fire/" + P, 
            // Content-Type: text/plain will avoid preflight requests which might
            // mess with CORS and redirects by proxies. If we add custom headers
            // we will need to change this code to potentially use the $httpOverwrite
            // parameter supported by ESF to avoid triggering preflight requests.
            t["Content-Type"] = "text/plain", this.databaseInfo.appId && (t["X-Firebase-GMPID"] = this.databaseInfo.appId), 
            e && e.headers.forEach(((e, n) => t[n] = e)), n && n.headers.forEach(((e, n) => t[n] = e));
        }
        ao(t, e) {
            const n = Wo[t];
            return `${this.oo}/v1/${e}:${n}`;
        }
    } {
        constructor(t) {
            super(t), this.forceLongPolling = t.forceLongPolling, this.autoDetectLongPolling = t.autoDetectLongPolling, 
            this.useFetchStreams = t.useFetchStreams;
        }
        lo(t, e, n, s) {
            return new Promise(((i, r) => {
                const o = new XhrIo;
                o.listenOnce(EventType.COMPLETE, (() => {
                    try {
                        switch (o.getLastErrorCode()) {
                          case ErrorCode.NO_ERROR:
                            const e = o.getResponseJson();
                            D("Connection", "XHR received:", JSON.stringify(e)), i(e);
                            break;

                          case ErrorCode.TIMEOUT:
                            D("Connection", 'RPC "' + t + '" timed out'), r(new B($.DEADLINE_EXCEEDED, "Request time out"));
                            break;

                          case ErrorCode.HTTP_ERROR:
                            const n = o.getStatus();
                            if (D("Connection", 'RPC "' + t + '" failed with status:', n, "response text:", o.getResponseText()), 
                            n > 0) {
                                const t = o.getResponseJson().error;
                                if (t && t.status && t.message) {
                                    const e = function(t) {
                                        const e = t.toLowerCase().replace(/_/g, "-");
                                        return Object.values($).indexOf(e) >= 0 ? e : $.UNKNOWN;
                                    }(t.status);
                                    r(new B(e, t.message));
                                } else r(new B($.UNKNOWN, "Server responded with status " + o.getStatus()));
                            } else 
                            // If we received an HTTP_ERROR but there's no status code,
                            // it's most probably a connection issue
                            r(new B($.UNAVAILABLE, "Connection failed."));
                            break;

                          default:
                            k();
                        }
                    } finally {
                        D("Connection", 'RPC "' + t + '" completed.');
                    }
                }));
                const u = JSON.stringify(s);
                o.send(e, "POST", u, n, 15);
            }));
        }
        _o(t, e, n) {
            const s = [ this.oo, "/", "google.firestore.v1.Firestore", "/", t, "/channel" ], i = createWebChannelTransport(), r = getStatEventTarget(), o = {
                // Required for backend stickiness, routing behavior is based on this
                // parameter.
                httpSessionIdParam: "gsessionid",
                initMessageHeaders: {},
                messageUrlParams: {
                    // This param is used to improve routing and project isolation by the
                    // backend and must be included in every request.
                    database: `projects/${this.databaseId.projectId}/databases/${this.databaseId.database}`
                },
                sendRawJson: !0,
                supportsCrossDomainXhr: !0,
                internalChannelParams: {
                    // Override the default timeout (randomized between 10-20 seconds) since
                    // a large write batch on a slow internet connection may take a long
                    // time to send to the backend. Rather than have WebChannel impose a
                    // tight timeout which could lead to infinite timeouts and retries, we
                    // set it very large (5-10 minutes) and rely on the browser's builtin
                    // timeouts to kick in if the request isn't working.
                    forwardChannelRequestTimeoutMs: 6e5
                },
                forceLongPolling: this.forceLongPolling,
                detectBufferingProxy: this.autoDetectLongPolling
            };
            this.useFetchStreams && (o.xmlHttpFactory = new FetchXmlHttpFactory({})), this.ho(o.initMessageHeaders, e, n), 
            // Sending the custom headers we just added to request.initMessageHeaders
            // (Authorization, etc.) will trigger the browser to make a CORS preflight
            // request because the XHR will no longer meet the criteria for a "simple"
            // CORS request:
            // https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#Simple_requests
            // Therefore to avoid the CORS preflight request (an extra network
            // roundtrip), we use the encodeInitMessageHeaders option to specify that
            // the headers should instead be encoded in the request's POST payload,
            // which is recognized by the webchannel backend.
            o.encodeInitMessageHeaders = !0;
            const u = s.join("");
            D("Connection", "Creating WebChannel: " + u, o);
            const c = i.createWebChannel(u, o);
            // WebChannel supports sending the first message with the handshake - saving
            // a network round trip. However, it will have to call send in the same
            // JS event loop as open. In order to enforce this, we delay actually
            // opening the WebChannel until send is called. Whether we have called
            // open is tracked with this variable.
                    let a = !1, h = !1;
            // A flag to determine whether the stream was closed (by us or through an
            // error/close event) to avoid delivering multiple close events or sending
            // on a closed stream
                    const l = new zo({
                Hr: t => {
                    h ? D("Connection", "Not sending because WebChannel is closed:", t) : (a || (D("Connection", "Opening WebChannel transport."), 
                    c.open(), a = !0), D("Connection", "WebChannel sending:", t), c.send(t));
                },
                Jr: () => c.close()
            }), f = (t, e, n) => {
                // TODO(dimond): closure typing seems broken because WebChannel does
                // not implement goog.events.Listenable
                t.listen(e, (t => {
                    try {
                        n(t);
                    } catch (t) {
                        setTimeout((() => {
                            throw t;
                        }), 0);
                    }
                }));
            };
            // Closure events are guarded and exceptions are swallowed, so catch any
            // exception and rethrow using a setTimeout so they become visible again.
            // Note that eventually this function could go away if we are confident
            // enough the code is exception free.
                    return f(c, WebChannel.EventType.OPEN, (() => {
                h || D("Connection", "WebChannel transport opened.");
            })), f(c, WebChannel.EventType.CLOSE, (() => {
                h || (h = !0, D("Connection", "WebChannel transport closed"), l.io());
            })), f(c, WebChannel.EventType.ERROR, (t => {
                h || (h = !0, x("Connection", "WebChannel transport errored:", t), l.io(new B($.UNAVAILABLE, "The operation could not be completed")));
            })), f(c, WebChannel.EventType.MESSAGE, (t => {
                var e;
                if (!h) {
                    const n = t.data[0];
                    M(!!n);
                    // TODO(b/35143891): There is a bug in One Platform that caused errors
                    // (and only errors) to be wrapped in an extra array. To be forward
                    // compatible with the bug we need to check either condition. The latter
                    // can be removed once the fix has been rolled out.
                    // Use any because msgData.error is not typed.
                    const s = n, i = s.error || (null === (e = s[0]) || void 0 === e ? void 0 : e.error);
                    if (i) {
                        D("Connection", "WebChannel received error:", i);
                        // error.status will be a string like 'OK' or 'NOT_FOUND'.
                        const t = i.status;
                        let e = 
                        /**
     * Maps an error Code from a GRPC status identifier like 'NOT_FOUND'.
     *
     * @returns The Code equivalent to the given status string or undefined if
     *     there is no match.
     */
                        function(t) {
                            // lookup by string
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const e = Jn[t];
                            if (void 0 !== e) return Zn(e);
                        }(t), n = i.message;
                        void 0 === e && (e = $.INTERNAL, n = "Unknown error status: " + t + " with message " + i.message), 
                        // Mark closed so no further events are propagated
                        h = !0, l.io(new B(e, n)), c.close();
                    } else D("Connection", "WebChannel received:", n), l.ro(n);
                }
            })), f(r, Event.STAT_EVENT, (t => {
                t.stat === Stat.PROXY ? D("Connection", "Detected buffering proxy") : t.stat === Stat.NOPROXY && D("Connection", "Detected no buffering proxy");
            })), setTimeout((() => {
                // Technically we could/should wait for the WebChannel opened event,
                // but because we want to send the first message with the WebChannel
                // handshake we pretend the channel opened here (asynchronously), and
                // then delay the actual open until the first message is sent.
                l.so();
            }), 0), l;
        }
    }

    /** The Platform's 'document' implementation or null if not available. */ function Yo() {
        // `document` is not always available, e.g. in ReactNative and WebWorkers.
        // eslint-disable-next-line no-restricted-globals
        return "undefined" != typeof document ? document : null;
    }

    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */ function Xo(t) {
        return new bs(t, /* useProto3Json= */ !0);
    }

    /**
     * An instance of the Platform's 'TextEncoder' implementation.
     */
    /**
     * A helper for running delayed tasks following an exponential backoff curve
     * between attempts.
     *
     * Each delay is made up of a "base" delay which follows the exponential
     * backoff curve, and a +/- 50% "jitter" that is calculated and added to the
     * base delay. This prevents clients from accidentally synchronizing their
     * delays causing spikes of load to the backend.
     */
    class Zo {
        constructor(
        /**
         * The AsyncQueue to run backoff operations on.
         */
        t, 
        /**
         * The ID to use when scheduling backoff operations on the AsyncQueue.
         */
        e, 
        /**
         * The initial delay (used as the base delay on the first retry attempt).
         * Note that jitter will still be applied, so the actual delay could be as
         * little as 0.5*initialDelayMs.
         */
        n = 1e3
        /**
         * The multiplier to use to determine the extended base delay after each
         * attempt.
         */ , s = 1.5
        /**
         * The maximum base delay after which no further backoff is performed.
         * Note that jitter will still be applied, so the actual delay could be as
         * much as 1.5*maxDelayMs.
         */ , i = 6e4) {
            this.Hs = t, this.timerId = e, this.wo = n, this.mo = s, this.yo = i, this.po = 0, 
            this.Io = null, 
            /** The last backoff attempt, as epoch milliseconds. */
            this.To = Date.now(), this.reset();
        }
        /**
         * Resets the backoff delay.
         *
         * The very next backoffAndWait() will have no delay. If it is called again
         * (i.e. due to an error), initialDelayMs (plus jitter) will be used, and
         * subsequent ones will increase according to the backoffFactor.
         */    reset() {
            this.po = 0;
        }
        /**
         * Resets the backoff delay to the maximum delay (e.g. for use after a
         * RESOURCE_EXHAUSTED error).
         */    Eo() {
            this.po = this.yo;
        }
        /**
         * Returns a promise that resolves after currentDelayMs, and increases the
         * delay for any subsequent attempts. If there was a pending backoff operation
         * already, it will be canceled.
         */    Ao(t) {
            // Cancel any pending backoff operation.
            this.cancel();
            // First schedule using the current base (which may be 0 and should be
            // honored as such).
            const e = Math.floor(this.po + this.Ro()), n = Math.max(0, Date.now() - this.To), s = Math.max(0, e - n);
            // Guard against lastAttemptTime being in the future due to a clock change.
                    s > 0 && D("ExponentialBackoff", `Backing off for ${s} ms (base delay: ${this.po} ms, delay with jitter: ${e} ms, last attempt: ${n} ms ago)`), 
            this.Io = this.Hs.enqueueAfterDelay(this.timerId, s, (() => (this.To = Date.now(), 
            t()))), 
            // Apply backoff factor to determine next delay and ensure it is within
            // bounds.
            this.po *= this.mo, this.po < this.wo && (this.po = this.wo), this.po > this.yo && (this.po = this.yo);
        }
        bo() {
            null !== this.Io && (this.Io.skipDelay(), this.Io = null);
        }
        cancel() {
            null !== this.Io && (this.Io.cancel(), this.Io = null);
        }
        /** Returns a random value in the range [-currentBaseMs/2, currentBaseMs/2] */    Ro() {
            return (Math.random() - .5) * this.po;
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * A PersistentStream is an abstract base class that represents a streaming RPC
     * to the Firestore backend. It's built on top of the connections own support
     * for streaming RPCs, and adds several critical features for our clients:
     *
     *   - Exponential backoff on failure
     *   - Authentication via CredentialsProvider
     *   - Dispatching all callbacks into the shared worker queue
     *   - Closing idle streams after 60 seconds of inactivity
     *
     * Subclasses of PersistentStream implement serialization of models to and
     * from the JSON representation of the protocol buffers for a specific
     * streaming RPC.
     *
     * ## Starting and Stopping
     *
     * Streaming RPCs are stateful and need to be start()ed before messages can
     * be sent and received. The PersistentStream will call the onOpen() function
     * of the listener once the stream is ready to accept requests.
     *
     * Should a start() fail, PersistentStream will call the registered onClose()
     * listener with a FirestoreError indicating what went wrong.
     *
     * A PersistentStream can be started and stopped repeatedly.
     *
     * Generic types:
     *  SendType: The type of the outgoing message of the underlying
     *    connection stream
     *  ReceiveType: The type of the incoming message of the underlying
     *    connection stream
     *  ListenerType: The type of the listener that will be used for callbacks
     */
    class tu {
        constructor(t, e, n, s, i, r, o, u) {
            this.Hs = t, this.Po = n, this.vo = s, this.Vo = i, this.authCredentialsProvider = r, 
            this.appCheckCredentialsProvider = o, this.listener = u, this.state = 0 /* Initial */ , 
            /**
             * A close count that's incremented every time the stream is closed; used by
             * getCloseGuardedDispatcher() to invalidate callbacks that happen after
             * close.
             */
            this.So = 0, this.Do = null, this.Co = null, this.stream = null, this.xo = new Zo(t, e);
        }
        /**
         * Returns true if start() has been called and no error has occurred. True
         * indicates the stream is open or in the process of opening (which
         * encompasses respecting backoff, getting auth tokens, and starting the
         * actual RPC). Use isOpen() to determine if the stream is open and ready for
         * outbound requests.
         */    No() {
            return 1 /* Starting */ === this.state || 5 /* Backoff */ === this.state || this.ko();
        }
        /**
         * Returns true if the underlying RPC is open (the onOpen() listener has been
         * called) and the stream is ready for outbound requests.
         */    ko() {
            return 2 /* Open */ === this.state || 3 /* Healthy */ === this.state;
        }
        /**
         * Starts the RPC. Only allowed if isStarted() returns false. The stream is
         * not immediately ready for use: onOpen() will be invoked when the RPC is
         * ready for outbound requests, at which point isOpen() will return true.
         *
         * When start returns, isStarted() will return true.
         */    start() {
            4 /* Error */ !== this.state ? this.auth() : this.Mo();
        }
        /**
         * Stops the RPC. This call is idempotent and allowed regardless of the
         * current isStarted() state.
         *
         * When stop returns, isStarted() and isOpen() will both return false.
         */    async stop() {
            this.No() && await this.close(0 /* Initial */);
        }
        /**
         * After an error the stream will usually back off on the next attempt to
         * start it. If the error warrants an immediate restart of the stream, the
         * sender can use this to indicate that the receiver should not back off.
         *
         * Each error will call the onClose() listener. That function can decide to
         * inhibit backoff if required.
         */    Oo() {
            this.state = 0 /* Initial */ , this.xo.reset();
        }
        /**
         * Marks this stream as idle. If no further actions are performed on the
         * stream for one minute, the stream will automatically close itself and
         * notify the stream's onClose() handler with Status.OK. The stream will then
         * be in a !isStarted() state, requiring the caller to start the stream again
         * before further use.
         *
         * Only streams that are in state 'Open' can be marked idle, as all other
         * states imply pending network operations.
         */    Fo() {
            // Starts the idle time if we are in state 'Open' and are not yet already
            // running a timer (in which case the previous idle timeout still applies).
            this.ko() && null === this.Do && (this.Do = this.Hs.enqueueAfterDelay(this.Po, 6e4, (() => this.$o())));
        }
        /** Sends a message to the underlying stream. */    Bo(t) {
            this.Lo(), this.stream.send(t);
        }
        /** Called by the idle timer when the stream should close due to inactivity. */    async $o() {
            if (this.ko()) 
            // When timing out an idle stream there's no reason to force the stream into backoff when
            // it restarts so set the stream state to Initial instead of Error.
            return this.close(0 /* Initial */);
        }
        /** Marks the stream as active again. */    Lo() {
            this.Do && (this.Do.cancel(), this.Do = null);
        }
        /** Cancels the health check delayed operation. */    Uo() {
            this.Co && (this.Co.cancel(), this.Co = null);
        }
        /**
         * Closes the stream and cleans up as necessary:
         *
         * * closes the underlying GRPC stream;
         * * calls the onClose handler with the given 'error';
         * * sets internal stream state to 'finalState';
         * * adjusts the backoff timer based on the error
         *
         * A new stream can be opened by calling start().
         *
         * @param finalState - the intended state of the stream after closing.
         * @param error - the error the connection was closed with.
         */    async close(t, e) {
            // Cancel any outstanding timers (they're guaranteed not to execute).
            this.Lo(), this.Uo(), this.xo.cancel(), 
            // Invalidates any stream-related callbacks (e.g. from auth or the
            // underlying stream), guaranteeing they won't execute.
            this.So++, 4 /* Error */ !== t ? 
            // If this is an intentional close ensure we don't delay our next connection attempt.
            this.xo.reset() : e && e.code === $.RESOURCE_EXHAUSTED ? (
            // Log the error. (Probably either 'quota exceeded' or 'max queue length reached'.)
            C(e.toString()), C("Using maximum backoff delay to prevent overloading the backend."), 
            this.xo.Eo()) : e && e.code === $.UNAUTHENTICATED && 3 /* Healthy */ !== this.state && (
            // "unauthenticated" error means the token was rejected. This should rarely
            // happen since both Auth and AppCheck ensure a sufficient TTL when we
            // request a token. If a user manually resets their system clock this can
            // fail, however. In this case, we should get a Code.UNAUTHENTICATED error
            // before we received the first message and we need to invalidate the token
            // to ensure that we fetch a new token.
            this.authCredentialsProvider.invalidateToken(), this.appCheckCredentialsProvider.invalidateToken()), 
            // Clean up the underlying stream because we are no longer interested in events.
            null !== this.stream && (this.qo(), this.stream.close(), this.stream = null), 
            // This state must be assigned before calling onClose() to allow the callback to
            // inhibit backoff or otherwise manipulate the state in its non-started state.
            this.state = t, 
            // Notify the listener that the stream closed.
            await this.listener.Zr(e);
        }
        /**
         * Can be overridden to perform additional cleanup before the stream is closed.
         * Calling super.tearDown() is not required.
         */    qo() {}
        auth() {
            this.state = 1 /* Starting */;
            const t = this.Ko(this.So), e = this.So;
            // TODO(mikelehen): Just use dispatchIfNotClosed, but see TODO below.
                    Promise.all([ this.authCredentialsProvider.getToken(), this.appCheckCredentialsProvider.getToken() ]).then((([t, n]) => {
                // Stream can be stopped while waiting for authentication.
                // TODO(mikelehen): We really should just use dispatchIfNotClosed
                // and let this dispatch onto the queue, but that opened a spec test can
                // of worms that I don't want to deal with in this PR.
                this.So === e && 
                // Normally we'd have to schedule the callback on the AsyncQueue.
                // However, the following calls are safe to be called outside the
                // AsyncQueue since they don't chain asynchronous calls
                this.Go(t, n);
            }), (e => {
                t((() => {
                    const t = new B($.UNKNOWN, "Fetching auth token failed: " + e.message);
                    return this.Qo(t);
                }));
            }));
        }
        Go(t, e) {
            const n = this.Ko(this.So);
            this.stream = this.jo(t, e), this.stream.Yr((() => {
                n((() => (this.state = 2 /* Open */ , this.Co = this.Hs.enqueueAfterDelay(this.vo, 1e4, (() => (this.ko() && (this.state = 3 /* Healthy */), 
                Promise.resolve()))), this.listener.Yr())));
            })), this.stream.Zr((t => {
                n((() => this.Qo(t)));
            })), this.stream.onMessage((t => {
                n((() => this.onMessage(t)));
            }));
        }
        Mo() {
            this.state = 5 /* Backoff */ , this.xo.Ao((async () => {
                this.state = 0 /* Initial */ , this.start();
            }));
        }
        // Visible for tests
        Qo(t) {
            // In theory the stream could close cleanly, however, in our current model
            // we never expect this to happen because if we stop a stream ourselves,
            // this callback will never be called. To prevent cases where we retry
            // without a backoff accidentally, we set the stream to error in all cases.
            return D("PersistentStream", `close with error: ${t}`), this.stream = null, this.close(4 /* Error */ , t);
        }
        /**
         * Returns a "dispatcher" function that dispatches operations onto the
         * AsyncQueue but only runs them if closeCount remains unchanged. This allows
         * us to turn auth / stream callbacks into no-ops if the stream is closed /
         * re-opened, etc.
         */    Ko(t) {
            return e => {
                this.Hs.enqueueAndForget((() => this.So === t ? e() : (D("PersistentStream", "stream callback skipped by getCloseGuardedDispatcher."), 
                Promise.resolve())));
            };
        }
    }

    /**
     * A PersistentStream that implements the Listen RPC.
     *
     * Once the Listen stream has called the onOpen() listener, any number of
     * listen() and unlisten() calls can be made to control what changes will be
     * sent from the server for ListenResponses.
     */ class eu extends tu {
        constructor(t, e, n, s, i, r) {
            super(t, "listen_stream_connection_backoff" /* ListenStreamConnectionBackoff */ , "listen_stream_idle" /* ListenStreamIdle */ , "health_check_timeout" /* HealthCheckTimeout */ , e, n, s, r), 
            this.It = i;
        }
        jo(t, e) {
            return this.Vo._o("Listen", t, e);
        }
        onMessage(t) {
            // A successful response means the stream is healthy
            this.xo.reset();
            const e = Us(this.It, t), n = function(t) {
                // We have only reached a consistent snapshot for the entire stream if there
                // is a read_time set and it applies to all targets (i.e. the list of
                // targets is empty). The backend is guaranteed to send such responses.
                if (!("targetChange" in t)) return nt.min();
                const e = t.targetChange;
                return e.targetIds && e.targetIds.length ? nt.min() : e.readTime ? Ss(e.readTime) : nt.min();
            }(t);
            return this.listener.Wo(e, n);
        }
        /**
         * Registers interest in the results of the given target. If the target
         * includes a resumeToken it will be included in the request. Results that
         * affect the target will be streamed back as WatchChange messages that
         * reference the targetId.
         */    zo(t) {
            const e = {};
            e.database = Os(this.It), e.addTarget = function(t, e) {
                let n;
                const s = e.target;
                return n = ke(s) ? {
                    documents: Qs(t, s)
                } : {
                    query: js(t, s)
                }, n.targetId = e.targetId, e.resumeToken.approximateByteSize() > 0 ? n.resumeToken = vs(t, e.resumeToken) : e.snapshotVersion.compareTo(nt.min()) > 0 && (
                // TODO(wuandy): Consider removing above check because it is most likely true.
                // Right now, many tests depend on this behaviour though (leaving min() out
                // of serialization).
                n.readTime = Ps(t, e.snapshotVersion.toTimestamp())), n;
            }(this.It, t);
            const n = zs(this.It, t);
            n && (e.labels = n), this.Bo(e);
        }
        /**
         * Unregisters interest in the results of the target associated with the
         * given targetId.
         */    Ho(t) {
            const e = {};
            e.database = Os(this.It), e.removeTarget = t, this.Bo(e);
        }
    }

    /**
     * A Stream that implements the Write RPC.
     *
     * The Write RPC requires the caller to maintain special streamToken
     * state in between calls, to help the server understand which responses the
     * client has processed by the time the next request is made. Every response
     * will contain a streamToken; this value must be passed to the next
     * request.
     *
     * After calling start() on this stream, the next request must be a handshake,
     * containing whatever streamToken is on hand. Once a response to this
     * request is received, all pending mutations may be submitted. When
     * submitting multiple batches of mutations at the same time, it's
     * okay to use the same streamToken for the calls to writeMutations.
     *
     * TODO(b/33271235): Use proto types
     */ class nu extends tu {
        constructor(t, e, n, s, i, r) {
            super(t, "write_stream_connection_backoff" /* WriteStreamConnectionBackoff */ , "write_stream_idle" /* WriteStreamIdle */ , "health_check_timeout" /* HealthCheckTimeout */ , e, n, s, r), 
            this.It = i, this.Jo = !1;
        }
        /**
         * Tracks whether or not a handshake has been successfully exchanged and
         * the stream is ready to accept mutations.
         */    get Yo() {
            return this.Jo;
        }
        // Override of PersistentStream.start
        start() {
            this.Jo = !1, this.lastStreamToken = void 0, super.start();
        }
        qo() {
            this.Jo && this.Xo([]);
        }
        jo(t, e) {
            return this.Vo._o("Write", t, e);
        }
        onMessage(t) {
            if (
            // Always capture the last stream token.
            M(!!t.streamToken), this.lastStreamToken = t.streamToken, this.Jo) {
                // A successful first write response means the stream is healthy,
                // Note, that we could consider a successful handshake healthy, however,
                // the write itself might be causing an error we want to back off from.
                this.xo.reset();
                const e = Gs(t.writeResults, t.commitTime), n = Ss(t.commitTime);
                return this.listener.Zo(n, e);
            }
            // The first response is always the handshake response
            return M(!t.writeResults || 0 === t.writeResults.length), this.Jo = !0, this.listener.tu();
        }
        /**
         * Sends an initial streamToken to the server, performing the handshake
         * required to make the StreamingWrite RPC work. Subsequent
         * calls should wait until onHandshakeComplete was called.
         */    eu() {
            // TODO(dimond): Support stream resumption. We intentionally do not set the
            // stream token on the handshake, ignoring any stream token we might have.
            const t = {};
            t.database = Os(this.It), this.Bo(t);
        }
        /** Sends a group of mutations to the Firestore backend to apply. */    Xo(t) {
            const e = {
                streamToken: this.lastStreamToken,
                writes: t.map((t => qs(this.It, t)))
            };
            this.Bo(e);
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Datastore and its related methods are a wrapper around the external Google
     * Cloud Datastore grpc API, which provides an interface that is more convenient
     * for the rest of the client SDK architecture to consume.
     */
    /**
     * An implementation of Datastore that exposes additional state for internal
     * consumption.
     */
    class su extends class {} {
        constructor(t, e, n, s) {
            super(), this.authCredentials = t, this.appCheckCredentials = e, this.Vo = n, this.It = s, 
            this.nu = !1;
        }
        su() {
            if (this.nu) throw new B($.FAILED_PRECONDITION, "The client has already been terminated.");
        }
        /** Invokes the provided RPC with auth and AppCheck tokens. */    co(t, e, n) {
            return this.su(), Promise.all([ this.authCredentials.getToken(), this.appCheckCredentials.getToken() ]).then((([s, i]) => this.Vo.co(t, e, n, s, i))).catch((t => {
                throw "FirebaseError" === t.name ? (t.code === $.UNAUTHENTICATED && (this.authCredentials.invalidateToken(), 
                this.appCheckCredentials.invalidateToken()), t) : new B($.UNKNOWN, t.toString());
            }));
        }
        /** Invokes the provided RPC with streamed results with auth and AppCheck tokens. */    fo(t, e, n, s) {
            return this.su(), Promise.all([ this.authCredentials.getToken(), this.appCheckCredentials.getToken() ]).then((([i, r]) => this.Vo.fo(t, e, n, i, r, s))).catch((t => {
                throw "FirebaseError" === t.name ? (t.code === $.UNAUTHENTICATED && (this.authCredentials.invalidateToken(), 
                this.appCheckCredentials.invalidateToken()), t) : new B($.UNKNOWN, t.toString());
            }));
        }
        terminate() {
            this.nu = !0;
        }
    }

    // TODO(firestorexp): Make sure there is only one Datastore instance per
    // firestore-exp client.
    /**
     * A component used by the RemoteStore to track the OnlineState (that is,
     * whether or not the client as a whole should be considered to be online or
     * offline), implementing the appropriate heuristics.
     *
     * In particular, when the client is trying to connect to the backend, we
     * allow up to MAX_WATCH_STREAM_FAILURES within ONLINE_STATE_TIMEOUT_MS for
     * a connection to succeed. If we have too many failures or the timeout elapses,
     * then we set the OnlineState to Offline, and the client will behave as if
     * it is offline (get()s will return cached data, etc.).
     */
    class iu {
        constructor(t, e) {
            this.asyncQueue = t, this.onlineStateHandler = e, 
            /** The current OnlineState. */
            this.state = "Unknown" /* Unknown */ , 
            /**
             * A count of consecutive failures to open the stream. If it reaches the
             * maximum defined by MAX_WATCH_STREAM_FAILURES, we'll set the OnlineState to
             * Offline.
             */
            this.iu = 0, 
            /**
             * A timer that elapses after ONLINE_STATE_TIMEOUT_MS, at which point we
             * transition from OnlineState.Unknown to OnlineState.Offline without waiting
             * for the stream to actually fail (MAX_WATCH_STREAM_FAILURES times).
             */
            this.ru = null, 
            /**
             * Whether the client should log a warning message if it fails to connect to
             * the backend (initially true, cleared after a successful stream, or if we've
             * logged the message already).
             */
            this.ou = !0;
        }
        /**
         * Called by RemoteStore when a watch stream is started (including on each
         * backoff attempt).
         *
         * If this is the first attempt, it sets the OnlineState to Unknown and starts
         * the onlineStateTimer.
         */    uu() {
            0 === this.iu && (this.cu("Unknown" /* Unknown */), this.ru = this.asyncQueue.enqueueAfterDelay("online_state_timeout" /* OnlineStateTimeout */ , 1e4, (() => (this.ru = null, 
            this.au("Backend didn't respond within 10 seconds."), this.cu("Offline" /* Offline */), 
            Promise.resolve()))));
        }
        /**
         * Updates our OnlineState as appropriate after the watch stream reports a
         * failure. The first failure moves us to the 'Unknown' state. We then may
         * allow multiple failures (based on MAX_WATCH_STREAM_FAILURES) before we
         * actually transition to the 'Offline' state.
         */    hu(t) {
            "Online" /* Online */ === this.state ? this.cu("Unknown" /* Unknown */) : (this.iu++, 
            this.iu >= 1 && (this.lu(), this.au(`Connection failed 1 times. Most recent error: ${t.toString()}`), 
            this.cu("Offline" /* Offline */)));
        }
        /**
         * Explicitly sets the OnlineState to the specified state.
         *
         * Note that this resets our timers / failure counters, etc. used by our
         * Offline heuristics, so must not be used in place of
         * handleWatchStreamStart() and handleWatchStreamFailure().
         */    set(t) {
            this.lu(), this.iu = 0, "Online" /* Online */ === t && (
            // We've connected to watch at least once. Don't warn the developer
            // about being offline going forward.
            this.ou = !1), this.cu(t);
        }
        cu(t) {
            t !== this.state && (this.state = t, this.onlineStateHandler(t));
        }
        au(t) {
            const e = `Could not reach Cloud Firestore backend. ${t}\nThis typically indicates that your device does not have a healthy Internet connection at the moment. The client will operate in offline mode until it is able to successfully connect to the backend.`;
            this.ou ? (C(e), this.ou = !1) : D("OnlineStateTracker", e);
        }
        lu() {
            null !== this.ru && (this.ru.cancel(), this.ru = null);
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */ class ru {
        constructor(
        /**
         * The local store, used to fill the write pipeline with outbound mutations.
         */
        t, 
        /** The client-side proxy for interacting with the backend. */
        e, n, s, i) {
            this.localStore = t, this.datastore = e, this.asyncQueue = n, this.remoteSyncer = {}, 
            /**
             * A list of up to MAX_PENDING_WRITES writes that we have fetched from the
             * LocalStore via fillWritePipeline() and have or will send to the write
             * stream.
             *
             * Whenever writePipeline.length > 0 the RemoteStore will attempt to start or
             * restart the write stream. When the stream is established the writes in the
             * pipeline will be sent in order.
             *
             * Writes remain in writePipeline until they are acknowledged by the backend
             * and thus will automatically be re-sent if the stream is interrupted /
             * restarted before they're acknowledged.
             *
             * Write responses from the backend are linked to their originating request
             * purely based on order, and so we can just shift() writes from the front of
             * the writePipeline as we receive responses.
             */
            this.fu = [], 
            /**
             * A mapping of watched targets that the client cares about tracking and the
             * user has explicitly called a 'listen' for this target.
             *
             * These targets may or may not have been sent to or acknowledged by the
             * server. On re-establishing the listen stream, these targets should be sent
             * to the server. The targets removed with unlistens are removed eagerly
             * without waiting for confirmation from the listen stream.
             */
            this.du = new Map, 
            /**
             * A set of reasons for why the RemoteStore may be offline. If empty, the
             * RemoteStore may start its network connections.
             */
            this._u = new Set, 
            /**
             * Event handlers that get called when the network is disabled or enabled.
             *
             * PORTING NOTE: These functions are used on the Web client to create the
             * underlying streams (to support tree-shakeable streams). On Android and iOS,
             * the streams are created during construction of RemoteStore.
             */
            this.wu = [], this.mu = i, this.mu.qr((t => {
                n.enqueueAndForget((async () => {
                    // Porting Note: Unlike iOS, `restartNetwork()` is called even when the
                    // network becomes unreachable as we don't have any other way to tear
                    // down our streams.
                    _u(this) && (D("RemoteStore", "Restarting streams for network reachability change."), 
                    await async function(t) {
                        const e = F(t);
                        e._u.add(4 /* ConnectivityChange */), await uu(e), e.gu.set("Unknown" /* Unknown */), 
                        e._u.delete(4 /* ConnectivityChange */), await ou(e);
                    }(this));
                }));
            })), this.gu = new iu(n, s);
        }
    }

    async function ou(t) {
        if (_u(t)) for (const e of t.wu) await e(/* enabled= */ !0);
    }

    /**
     * Temporarily disables the network. The network can be re-enabled using
     * enableNetwork().
     */ async function uu(t) {
        for (const e of t.wu) await e(/* enabled= */ !1);
    }

    /**
     * Starts new listen for the given target. Uses resume token if provided. It
     * is a no-op if the target of given `TargetData` is already being listened to.
     */
    function cu(t, e) {
        const n = F(t);
        n.du.has(e.targetId) || (
        // Mark this as something the client is currently listening for.
        n.du.set(e.targetId, e), du(n) ? 
        // The listen will be sent in onWatchStreamOpen
        fu(n) : xu(n).ko() && hu(n, e));
    }

    /**
     * Removes the listen from server. It is a no-op if the given target id is
     * not being listened to.
     */ function au(t, e) {
        const n = F(t), s = xu(n);
        n.du.delete(e), s.ko() && lu(n, e), 0 === n.du.size && (s.ko() ? s.Fo() : _u(n) && 
        // Revert to OnlineState.Unknown if the watch stream is not open and we
        // have no listeners, since without any listens to send we cannot
        // confirm if the stream is healthy and upgrade to OnlineState.Online.
        n.gu.set("Unknown" /* Unknown */));
    }

    /**
     * We need to increment the the expected number of pending responses we're due
     * from watch so we wait for the ack to process any messages from this target.
     */ function hu(t, e) {
        t.yu.Ot(e.targetId), xu(t).zo(e);
    }

    /**
     * We need to increment the expected number of pending responses we're due
     * from watch so we wait for the removal on the server before we process any
     * messages from this target.
     */ function lu(t, e) {
        t.yu.Ot(e), xu(t).Ho(e);
    }

    function fu(t) {
        t.yu = new Is({
            getRemoteKeysForTarget: e => t.remoteSyncer.getRemoteKeysForTarget(e),
            se: e => t.du.get(e) || null
        }), xu(t).start(), t.gu.uu();
    }

    /**
     * Returns whether the watch stream should be started because it's necessary
     * and has not yet been started.
     */ function du(t) {
        return _u(t) && !xu(t).No() && t.du.size > 0;
    }

    function _u(t) {
        return 0 === F(t)._u.size;
    }

    function wu(t) {
        t.yu = void 0;
    }

    async function mu(t) {
        t.du.forEach(((e, n) => {
            hu(t, e);
        }));
    }

    async function gu(t, e) {
        wu(t), 
        // If we still need the watch stream, retry the connection.
        du(t) ? (t.gu.hu(e), fu(t)) : 
        // No need to restart watch stream because there are no active targets.
        // The online state is set to unknown because there is no active attempt
        // at establishing a connection
        t.gu.set("Unknown" /* Unknown */);
    }

    async function yu(t, e, n) {
        if (
        // Mark the client as online since we got a message from the server
        t.gu.set("Online" /* Online */), e instanceof ys && 2 /* Removed */ === e.state && e.cause) 
        // There was an error on a target, don't wait for a consistent snapshot
        // to raise events
        try {
            await 
            /** Handles an error on a target */
            async function(t, e) {
                const n = e.cause;
                for (const s of e.targetIds) 
                // A watched target might have been removed already.
                t.du.has(s) && (await t.remoteSyncer.rejectListen(s, n), t.du.delete(s), t.yu.removeTarget(s));
            }
            /**
     * Attempts to fill our write pipeline with writes from the LocalStore.
     *
     * Called internally to bootstrap or refill the write pipeline and by
     * SyncEngine whenever there are new mutations to process.
     *
     * Starts the write stream if necessary.
     */ (t, e);
        } catch (n) {
            D("RemoteStore", "Failed to remove targets %s: %s ", e.targetIds.join(","), n), 
            await pu(t, n);
        } else if (e instanceof ms ? t.yu.Gt(e) : e instanceof gs ? t.yu.Yt(e) : t.yu.Wt(e), 
        !n.isEqual(nt.min())) try {
            const e = await Ao(t.localStore);
            n.compareTo(e) >= 0 && 
            // We have received a target change with a global snapshot if the snapshot
            // version is not equal to SnapshotVersion.min().
            await 
            /**
     * Takes a batch of changes from the Datastore, repackages them as a
     * RemoteEvent, and passes that on to the listener, which is typically the
     * SyncEngine.
     */
            function(t, e) {
                const n = t.yu.te(e);
                // Update in-memory resume tokens. LocalStore will update the
                // persistent view of these when applying the completed RemoteEvent.
                            return n.targetChanges.forEach(((n, s) => {
                    if (n.resumeToken.approximateByteSize() > 0) {
                        const i = t.du.get(s);
                        // A watched target might have been removed already.
                                            i && t.du.set(s, i.withResumeToken(n.resumeToken, e));
                    }
                })), 
                // Re-establish listens for the targets that have been invalidated by
                // existence filter mismatches.
                n.targetMismatches.forEach((e => {
                    const n = t.du.get(e);
                    if (!n) 
                    // A watched target might have been removed already.
                    return;
                    // Clear the resume token for the target, since we're in a known mismatch
                    // state.
                                    t.du.set(e, n.withResumeToken(jt.EMPTY_BYTE_STRING, n.snapshotVersion)), 
                    // Cause a hard reset by unwatching and rewatching immediately, but
                    // deliberately don't send a resume token so that we get a full update.
                    lu(t, e);
                    // Mark the target we send as being on behalf of an existence filter
                    // mismatch, but don't actually retain that in listenTargets. This ensures
                    // that we flag the first re-listen this way without impacting future
                    // listens of this target (that might happen e.g. on reconnect).
                    const s = new Oi(n.target, e, 1 /* ExistenceFilterMismatch */ , n.sequenceNumber);
                    hu(t, s);
                })), t.remoteSyncer.applyRemoteEvent(n);
            }(t, n);
        } catch (e) {
            D("RemoteStore", "Failed to raise snapshot:", e), await pu(t, e);
        }
    }

    /**
     * Recovery logic for IndexedDB errors that takes the network offline until
     * `op` succeeds. Retries are scheduled with backoff using
     * `enqueueRetryable()`. If `op()` is not provided, IndexedDB access is
     * validated via a generic operation.
     *
     * The returned Promise is resolved once the network is disabled and before
     * any retry attempt.
     */ async function pu(t, e, n) {
        if (!vt(e)) throw e;
        t._u.add(1 /* IndexedDbFailed */), 
        // Disable network and raise offline snapshots
        await uu(t), t.gu.set("Offline" /* Offline */), n || (
        // Use a simple read operation to determine if IndexedDB recovered.
        // Ideally, we would expose a health check directly on SimpleDb, but
        // RemoteStore only has access to persistence through LocalStore.
        n = () => Ao(t.localStore)), 
        // Probe IndexedDB periodically and re-enable network
        t.asyncQueue.enqueueRetryable((async () => {
            D("RemoteStore", "Retrying IndexedDB access"), await n(), t._u.delete(1 /* IndexedDbFailed */), 
            await ou(t);
        }));
    }

    /**
     * Executes `op`. If `op` fails, takes the network offline until `op`
     * succeeds. Returns after the first attempt.
     */ function Iu(t, e) {
        return e().catch((n => pu(t, n, e)));
    }

    async function Tu(t) {
        const e = F(t), n = Nu(e);
        let s = e.fu.length > 0 ? e.fu[e.fu.length - 1].batchId : -1;
        for (;Eu(e); ) try {
            const t = await Po(e.localStore, s);
            if (null === t) {
                0 === e.fu.length && n.Fo();
                break;
            }
            s = t.batchId, Au(e, t);
        } catch (t) {
            await pu(e, t);
        }
        Ru(e) && bu(e);
    }

    /**
     * Returns true if we can add to the write pipeline (i.e. the network is
     * enabled and the write pipeline is not full).
     */ function Eu(t) {
        return _u(t) && t.fu.length < 10;
    }

    /**
     * Queues additional writes to be sent to the write stream, sending them
     * immediately if the write stream is established.
     */ function Au(t, e) {
        t.fu.push(e);
        const n = Nu(t);
        n.ko() && n.Yo && n.Xo(e.mutations);
    }

    function Ru(t) {
        return _u(t) && !Nu(t).No() && t.fu.length > 0;
    }

    function bu(t) {
        Nu(t).start();
    }

    async function Pu(t) {
        Nu(t).eu();
    }

    async function vu(t) {
        const e = Nu(t);
        // Send the write pipeline now that the stream is established.
            for (const n of t.fu) e.Xo(n.mutations);
    }

    async function Vu(t, e, n) {
        const s = t.fu.shift(), i = ki.from(s, e, n);
        await Iu(t, (() => t.remoteSyncer.applySuccessfulWrite(i))), 
        // It's possible that with the completion of this mutation another
        // slot has freed up.
        await Tu(t);
    }

    async function Su(t, e) {
        // If the write stream closed after the write handshake completes, a write
        // operation failed and we fail the pending operation.
        e && Nu(t).Yo && 
        // This error affects the actual write.
        await async function(t, e) {
            // Only handle permanent errors here. If it's transient, just let the retry
            // logic kick in.
            if (n = e.code, Xn(n) && n !== $.ABORTED) {
                // This was a permanent error, the request itself was the problem
                // so it's not going to succeed if we resend it.
                const n = t.fu.shift();
                // In this case it's also unlikely that the server itself is melting
                // down -- this was just a bad request so inhibit backoff on the next
                // restart.
                            Nu(t).Oo(), await Iu(t, (() => t.remoteSyncer.rejectFailedWrite(n.batchId, e))), 
                // It's possible that with the completion of this mutation
                // another slot has freed up.
                await Tu(t);
            }
            var n;
        }(t, e), 
        // The write stream might have been started by refilling the write
        // pipeline for failed writes
        Ru(t) && bu(t);
    }

    async function Du(t, e) {
        const n = F(t);
        n.asyncQueue.verifyOperationInProgress(), D("RemoteStore", "RemoteStore received new credentials");
        const s = _u(n);
        // Tear down and re-create our network streams. This will ensure we get a
        // fresh auth token for the new user and re-fill the write pipeline with
        // new mutations from the LocalStore (since mutations are per-user).
            n._u.add(3 /* CredentialChange */), await uu(n), s && 
        // Don't set the network status to Unknown if we are offline.
        n.gu.set("Unknown" /* Unknown */), await n.remoteSyncer.handleCredentialChange(e), 
        n._u.delete(3 /* CredentialChange */), await ou(n);
    }

    /**
     * Toggles the network state when the client gains or loses its primary lease.
     */ async function Cu(t, e) {
        const n = F(t);
        e ? (n._u.delete(2 /* IsSecondary */), await ou(n)) : e || (n._u.add(2 /* IsSecondary */), 
        await uu(n), n.gu.set("Unknown" /* Unknown */));
    }

    /**
     * If not yet initialized, registers the WatchStream and its network state
     * callback with `remoteStoreImpl`. Returns the existing stream if one is
     * already available.
     *
     * PORTING NOTE: On iOS and Android, the WatchStream gets registered on startup.
     * This is not done on Web to allow it to be tree-shaken.
     */ function xu(t) {
        return t.pu || (
        // Create stream (but note that it is not started yet).
        t.pu = function(t, e, n) {
            const s = F(t);
            return s.su(), new eu(e, s.Vo, s.authCredentials, s.appCheckCredentials, s.It, n);
        }
        /**
     * @license
     * Copyright 2018 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */ (t.datastore, t.asyncQueue, {
            Yr: mu.bind(null, t),
            Zr: gu.bind(null, t),
            Wo: yu.bind(null, t)
        }), t.wu.push((async e => {
            e ? (t.pu.Oo(), du(t) ? fu(t) : t.gu.set("Unknown" /* Unknown */)) : (await t.pu.stop(), 
            wu(t));
        }))), t.pu;
    }

    /**
     * If not yet initialized, registers the WriteStream and its network state
     * callback with `remoteStoreImpl`. Returns the existing stream if one is
     * already available.
     *
     * PORTING NOTE: On iOS and Android, the WriteStream gets registered on startup.
     * This is not done on Web to allow it to be tree-shaken.
     */ function Nu(t) {
        return t.Iu || (
        // Create stream (but note that it is not started yet).
        t.Iu = function(t, e, n) {
            const s = F(t);
            return s.su(), new nu(e, s.Vo, s.authCredentials, s.appCheckCredentials, s.It, n);
        }(t.datastore, t.asyncQueue, {
            Yr: Pu.bind(null, t),
            Zr: Su.bind(null, t),
            tu: vu.bind(null, t),
            Zo: Vu.bind(null, t)
        }), t.wu.push((async e => {
            e ? (t.Iu.Oo(), 
            // This will start the write stream if necessary.
            await Tu(t)) : (await t.Iu.stop(), t.fu.length > 0 && (D("RemoteStore", `Stopping write stream with ${t.fu.length} pending writes`), 
            t.fu = []));
        }))), t.Iu;
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Represents an operation scheduled to be run in the future on an AsyncQueue.
     *
     * It is created via DelayedOperation.createAndSchedule().
     *
     * Supports cancellation (via cancel()) and early execution (via skipDelay()).
     *
     * Note: We implement `PromiseLike` instead of `Promise`, as the `Promise` type
     * in newer versions of TypeScript defines `finally`, which is not available in
     * IE.
     */
    class ku {
        constructor(t, e, n, s, i) {
            this.asyncQueue = t, this.timerId = e, this.targetTimeMs = n, this.op = s, this.removalCallback = i, 
            this.deferred = new L, this.then = this.deferred.promise.then.bind(this.deferred.promise), 
            // It's normal for the deferred promise to be canceled (due to cancellation)
            // and so we attach a dummy catch callback to avoid
            // 'UnhandledPromiseRejectionWarning' log spam.
            this.deferred.promise.catch((t => {}));
        }
        /**
         * Creates and returns a DelayedOperation that has been scheduled to be
         * executed on the provided asyncQueue after the provided delayMs.
         *
         * @param asyncQueue - The queue to schedule the operation on.
         * @param id - A Timer ID identifying the type of operation this is.
         * @param delayMs - The delay (ms) before the operation should be scheduled.
         * @param op - The operation to run.
         * @param removalCallback - A callback to be called synchronously once the
         *   operation is executed or canceled, notifying the AsyncQueue to remove it
         *   from its delayedOperations list.
         *   PORTING NOTE: This exists to prevent making removeDelayedOperation() and
         *   the DelayedOperation class public.
         */    static createAndSchedule(t, e, n, s, i) {
            const r = Date.now() + n, o = new ku(t, e, r, s, i);
            return o.start(n), o;
        }
        /**
         * Starts the timer. This is called immediately after construction by
         * createAndSchedule().
         */    start(t) {
            this.timerHandle = setTimeout((() => this.handleDelayElapsed()), t);
        }
        /**
         * Queues the operation to run immediately (if it hasn't already been run or
         * canceled).
         */    skipDelay() {
            return this.handleDelayElapsed();
        }
        /**
         * Cancels the operation if it hasn't already been executed or canceled. The
         * promise will be rejected.
         *
         * As long as the operation has not yet been run, calling cancel() provides a
         * guarantee that the operation will not be run.
         */    cancel(t) {
            null !== this.timerHandle && (this.clearTimeout(), this.deferred.reject(new B($.CANCELLED, "Operation cancelled" + (t ? ": " + t : ""))));
        }
        handleDelayElapsed() {
            this.asyncQueue.enqueueAndForget((() => null !== this.timerHandle ? (this.clearTimeout(), 
            this.op().then((t => this.deferred.resolve(t)))) : Promise.resolve()));
        }
        clearTimeout() {
            null !== this.timerHandle && (this.removalCallback(this), clearTimeout(this.timerHandle), 
            this.timerHandle = null);
        }
    }

    /**
     * Returns a FirestoreError that can be surfaced to the user if the provided
     * error is an IndexedDbTransactionError. Re-throws the error otherwise.
     */ function Mu(t, e) {
        if (C("AsyncQueue", `${e}: ${t}`), vt(t)) return new B($.UNAVAILABLE, `${e}: ${t}`);
        throw t;
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * DocumentSet is an immutable (copy-on-write) collection that holds documents
     * in order specified by the provided comparator. We always add a document key
     * comparator on top of what is provided to guarantee document equality based on
     * the key.
     */ class Ou {
        /** The default ordering is by key if the comparator is omitted */
        constructor(t) {
            // We are adding document key comparator to the end as it's the only
            // guaranteed unique property of a document.
            this.comparator = t ? (e, n) => t(e, n) || ut.comparator(e.key, n.key) : (t, e) => ut.comparator(t.key, e.key), 
            this.keyedMap = is(), this.sortedSet = new $t(this.comparator);
        }
        /**
         * Returns an empty copy of the existing DocumentSet, using the same
         * comparator.
         */    static emptySet(t) {
            return new Ou(t.comparator);
        }
        has(t) {
            return null != this.keyedMap.get(t);
        }
        get(t) {
            return this.keyedMap.get(t);
        }
        first() {
            return this.sortedSet.minKey();
        }
        last() {
            return this.sortedSet.maxKey();
        }
        isEmpty() {
            return this.sortedSet.isEmpty();
        }
        /**
         * Returns the index of the provided key in the document set, or -1 if the
         * document key is not present in the set;
         */    indexOf(t) {
            const e = this.keyedMap.get(t);
            return e ? this.sortedSet.indexOf(e) : -1;
        }
        get size() {
            return this.sortedSet.size;
        }
        /** Iterates documents in order defined by "comparator" */    forEach(t) {
            this.sortedSet.inorderTraversal(((e, n) => (t(e), !1)));
        }
        /** Inserts or updates a document with the same key */    add(t) {
            // First remove the element if we have it.
            const e = this.delete(t.key);
            return e.copy(e.keyedMap.insert(t.key, t), e.sortedSet.insert(t, null));
        }
        /** Deletes a document with a given key */    delete(t) {
            const e = this.get(t);
            return e ? this.copy(this.keyedMap.remove(t), this.sortedSet.remove(e)) : this;
        }
        isEqual(t) {
            if (!(t instanceof Ou)) return !1;
            if (this.size !== t.size) return !1;
            const e = this.sortedSet.getIterator(), n = t.sortedSet.getIterator();
            for (;e.hasNext(); ) {
                const t = e.getNext().key, s = n.getNext().key;
                if (!t.isEqual(s)) return !1;
            }
            return !0;
        }
        toString() {
            const t = [];
            return this.forEach((e => {
                t.push(e.toString());
            })), 0 === t.length ? "DocumentSet ()" : "DocumentSet (\n  " + t.join("  \n") + "\n)";
        }
        copy(t, e) {
            const n = new Ou;
            return n.comparator = this.comparator, n.keyedMap = t, n.sortedSet = e, n;
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * DocumentChangeSet keeps track of a set of changes to docs in a query, merging
     * duplicate events for the same doc.
     */ class Fu {
        constructor() {
            this.Tu = new $t(ut.comparator);
        }
        track(t) {
            const e = t.doc.key, n = this.Tu.get(e);
            n ? 
            // Merge the new change with the existing change.
            0 /* Added */ !== t.type && 3 /* Metadata */ === n.type ? this.Tu = this.Tu.insert(e, t) : 3 /* Metadata */ === t.type && 1 /* Removed */ !== n.type ? this.Tu = this.Tu.insert(e, {
                type: n.type,
                doc: t.doc
            }) : 2 /* Modified */ === t.type && 2 /* Modified */ === n.type ? this.Tu = this.Tu.insert(e, {
                type: 2 /* Modified */ ,
                doc: t.doc
            }) : 2 /* Modified */ === t.type && 0 /* Added */ === n.type ? this.Tu = this.Tu.insert(e, {
                type: 0 /* Added */ ,
                doc: t.doc
            }) : 1 /* Removed */ === t.type && 0 /* Added */ === n.type ? this.Tu = this.Tu.remove(e) : 1 /* Removed */ === t.type && 2 /* Modified */ === n.type ? this.Tu = this.Tu.insert(e, {
                type: 1 /* Removed */ ,
                doc: n.doc
            }) : 0 /* Added */ === t.type && 1 /* Removed */ === n.type ? this.Tu = this.Tu.insert(e, {
                type: 2 /* Modified */ ,
                doc: t.doc
            }) : 
            // This includes these cases, which don't make sense:
            // Added->Added
            // Removed->Removed
            // Modified->Added
            // Removed->Modified
            // Metadata->Added
            // Removed->Metadata
            k() : this.Tu = this.Tu.insert(e, t);
        }
        Eu() {
            const t = [];
            return this.Tu.inorderTraversal(((e, n) => {
                t.push(n);
            })), t;
        }
    }

    class $u {
        constructor(t, e, n, s, i, r, o, u) {
            this.query = t, this.docs = e, this.oldDocs = n, this.docChanges = s, this.mutatedKeys = i, 
            this.fromCache = r, this.syncStateChanged = o, this.excludesMetadataChanges = u;
        }
        /** Returns a view snapshot as if all documents in the snapshot were added. */    static fromInitialDocuments(t, e, n, s) {
            const i = [];
            return e.forEach((t => {
                i.push({
                    type: 0 /* Added */ ,
                    doc: t
                });
            })), new $u(t, e, Ou.emptySet(e), i, n, s, 
            /* syncStateChanged= */ !0, 
            /* excludesMetadataChanges= */ !1);
        }
        get hasPendingWrites() {
            return !this.mutatedKeys.isEmpty();
        }
        isEqual(t) {
            if (!(this.fromCache === t.fromCache && this.syncStateChanged === t.syncStateChanged && this.mutatedKeys.isEqual(t.mutatedKeys) && an(this.query, t.query) && this.docs.isEqual(t.docs) && this.oldDocs.isEqual(t.oldDocs))) return !1;
            const e = this.docChanges, n = t.docChanges;
            if (e.length !== n.length) return !1;
            for (let t = 0; t < e.length; t++) if (e[t].type !== n[t].type || !e[t].doc.isEqual(n[t].doc)) return !1;
            return !0;
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Holds the listeners and the last received ViewSnapshot for a query being
     * tracked by EventManager.
     */ class Bu {
        constructor() {
            this.Au = void 0, this.listeners = [];
        }
    }

    class Lu {
        constructor() {
            this.queries = new ts((t => hn(t)), an), this.onlineState = "Unknown" /* Unknown */ , 
            this.Ru = new Set;
        }
    }

    async function Uu(t, e) {
        const n = F(t), s = e.query;
        let i = !1, r = n.queries.get(s);
        if (r || (i = !0, r = new Bu), i) try {
            r.Au = await n.onListen(s);
        } catch (t) {
            const n = Mu(t, `Initialization of query '${ln(e.query)}' failed`);
            return void e.onError(n);
        }
        if (n.queries.set(s, r), r.listeners.push(e), 
        // Run global snapshot listeners if a consistent snapshot has been emitted.
        e.bu(n.onlineState), r.Au) {
            e.Pu(r.Au) && Qu(n);
        }
    }

    async function qu(t, e) {
        const n = F(t), s = e.query;
        let i = !1;
        const r = n.queries.get(s);
        if (r) {
            const t = r.listeners.indexOf(e);
            t >= 0 && (r.listeners.splice(t, 1), i = 0 === r.listeners.length);
        }
        if (i) return n.queries.delete(s), n.onUnlisten(s);
    }

    function Ku(t, e) {
        const n = F(t);
        let s = !1;
        for (const t of e) {
            const e = t.query, i = n.queries.get(e);
            if (i) {
                for (const e of i.listeners) e.Pu(t) && (s = !0);
                i.Au = t;
            }
        }
        s && Qu(n);
    }

    function Gu(t, e, n) {
        const s = F(t), i = s.queries.get(e);
        if (i) for (const t of i.listeners) t.onError(n);
        // Remove all listeners. NOTE: We don't need to call syncEngine.unlisten()
        // after an error.
            s.queries.delete(e);
    }

    // Call all global snapshot listeners that have been set.
    function Qu(t) {
        t.Ru.forEach((t => {
            t.next();
        }));
    }

    /**
     * QueryListener takes a series of internal view snapshots and determines
     * when to raise the event.
     *
     * It uses an Observer to dispatch events.
     */ class ju {
        constructor(t, e, n) {
            this.query = t, this.vu = e, 
            /**
             * Initial snapshots (e.g. from cache) may not be propagated to the wrapped
             * observer. This flag is set to true once we've actually raised an event.
             */
            this.Vu = !1, this.Su = null, this.onlineState = "Unknown" /* Unknown */ , this.options = n || {};
        }
        /**
         * Applies the new ViewSnapshot to this listener, raising a user-facing event
         * if applicable (depending on what changed, whether the user has opted into
         * metadata-only changes, etc.). Returns true if a user-facing event was
         * indeed raised.
         */    Pu(t) {
            if (!this.options.includeMetadataChanges) {
                // Remove the metadata only changes.
                const e = [];
                for (const n of t.docChanges) 3 /* Metadata */ !== n.type && e.push(n);
                t = new $u(t.query, t.docs, t.oldDocs, e, t.mutatedKeys, t.fromCache, t.syncStateChanged, 
                /* excludesMetadataChanges= */ !0);
            }
            let e = !1;
            return this.Vu ? this.Du(t) && (this.vu.next(t), e = !0) : this.Cu(t, this.onlineState) && (this.xu(t), 
            e = !0), this.Su = t, e;
        }
        onError(t) {
            this.vu.error(t);
        }
        /** Returns whether a snapshot was raised. */    bu(t) {
            this.onlineState = t;
            let e = !1;
            return this.Su && !this.Vu && this.Cu(this.Su, t) && (this.xu(this.Su), e = !0), 
            e;
        }
        Cu(t, e) {
            // Always raise the first event when we're synced
            if (!t.fromCache) return !0;
            // NOTE: We consider OnlineState.Unknown as online (it should become Offline
            // or Online if we wait long enough).
                    const n = "Offline" /* Offline */ !== e;
            // Don't raise the event if we're online, aren't synced yet (checked
            // above) and are waiting for a sync.
                    return (!this.options.Nu || !n) && (!t.docs.isEmpty() || "Offline" /* Offline */ === e);
            // Raise data from cache if we have any documents or we are offline
            }
        Du(t) {
            // We don't need to handle includeDocumentMetadataChanges here because
            // the Metadata only changes have already been stripped out if needed.
            // At this point the only changes we will see are the ones we should
            // propagate.
            if (t.docChanges.length > 0) return !0;
            const e = this.Su && this.Su.hasPendingWrites !== t.hasPendingWrites;
            return !(!t.syncStateChanged && !e) && !0 === this.options.includeMetadataChanges;
            // Generally we should have hit one of the cases above, but it's possible
            // to get here if there were only metadata docChanges and they got
            // stripped out.
            }
        xu(t) {
            t = $u.fromInitialDocuments(t.query, t.docs, t.mutatedKeys, t.fromCache), this.Vu = !0, 
            this.vu.next(t);
        }
    }

    /**
     * Returns a `LoadBundleTaskProgress` representing the progress that the loading
     * has succeeded.
     */
    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    class Yu {
        constructor(t) {
            this.key = t;
        }
    }

    class Xu {
        constructor(t) {
            this.key = t;
        }
    }

    /**
     * View is responsible for computing the final merged truth of what docs are in
     * a query. It gets notified of local and remote changes to docs, and applies
     * the query filters and limits to determine the most correct possible results.
     */ class Zu {
        constructor(t, 
        /** Documents included in the remote target */
        e) {
            this.query = t, this.Lu = e, this.Uu = null, 
            /**
             * A flag whether the view is current with the backend. A view is considered
             * current after it has seen the current flag from the backend and did not
             * lose consistency within the watch stream (e.g. because of an existence
             * filter mismatch).
             */
            this.current = !1, 
            /** Documents in the view but not in the remote target */
            this.qu = ls(), 
            /** Document Keys that have local changes */
            this.mutatedKeys = ls(), this.Ku = _n(t), this.Gu = new Ou(this.Ku);
        }
        /**
         * The set of remote documents that the server has told us belongs to the target associated with
         * this view.
         */    get Qu() {
            return this.Lu;
        }
        /**
         * Iterates over a set of doc changes, applies the query limit, and computes
         * what the new results should be, what the changes were, and whether we may
         * need to go back to the local cache for more results. Does not make any
         * changes to the view.
         * @param docChanges - The doc changes to apply to this view.
         * @param previousChanges - If this is being called with a refill, then start
         *        with this set of docs and changes instead of the current view.
         * @returns a new set of docs, changes, and refill flag.
         */    ju(t, e) {
            const n = e ? e.Wu : new Fu, s = e ? e.Gu : this.Gu;
            let i = e ? e.mutatedKeys : this.mutatedKeys, r = s, o = !1;
            // Track the last doc in a (full) limit. This is necessary, because some
            // update (a delete, or an update moving a doc past the old limit) might
            // mean there is some other document in the local cache that either should
            // come (1) between the old last limit doc and the new last document, in the
            // case of updates, or (2) after the new last document, in the case of
            // deletes. So we keep this doc at the old limit to compare the updates to.
            // Note that this should never get used in a refill (when previousChanges is
            // set), because there will only be adds -- no deletes or updates.
            const u = "F" /* First */ === this.query.limitType && s.size === this.query.limit ? s.last() : null, c = "L" /* Last */ === this.query.limitType && s.size === this.query.limit ? s.first() : null;
            // Drop documents out to meet limit/limitToLast requirement.
            if (t.inorderTraversal(((t, e) => {
                const a = s.get(t), h = fn(this.query, e) ? e : null, l = !!a && this.mutatedKeys.has(a.key), f = !!h && (h.hasLocalMutations || 
                // We only consider committed mutations for documents that were
                // mutated during the lifetime of the view.
                this.mutatedKeys.has(h.key) && h.hasCommittedMutations);
                let d = !1;
                // Calculate change
                            if (a && h) {
                    a.data.isEqual(h.data) ? l !== f && (n.track({
                        type: 3 /* Metadata */ ,
                        doc: h
                    }), d = !0) : this.zu(a, h) || (n.track({
                        type: 2 /* Modified */ ,
                        doc: h
                    }), d = !0, (u && this.Ku(h, u) > 0 || c && this.Ku(h, c) < 0) && (
                    // This doc moved from inside the limit to outside the limit.
                    // That means there may be some other doc in the local cache
                    // that should be included instead.
                    o = !0));
                } else !a && h ? (n.track({
                    type: 0 /* Added */ ,
                    doc: h
                }), d = !0) : a && !h && (n.track({
                    type: 1 /* Removed */ ,
                    doc: a
                }), d = !0, (u || c) && (
                // A doc was removed from a full limit query. We'll need to
                // requery from the local cache to see if we know about some other
                // doc that should be in the results.
                o = !0));
                d && (h ? (r = r.add(h), i = f ? i.add(t) : i.delete(t)) : (r = r.delete(t), i = i.delete(t)));
            })), null !== this.query.limit) for (;r.size > this.query.limit; ) {
                const t = "F" /* First */ === this.query.limitType ? r.last() : r.first();
                r = r.delete(t.key), i = i.delete(t.key), n.track({
                    type: 1 /* Removed */ ,
                    doc: t
                });
            }
            return {
                Gu: r,
                Wu: n,
                $i: o,
                mutatedKeys: i
            };
        }
        zu(t, e) {
            // We suppress the initial change event for documents that were modified as
            // part of a write acknowledgment (e.g. when the value of a server transform
            // is applied) as Watch will send us the same document again.
            // By suppressing the event, we only raise two user visible events (one with
            // `hasPendingWrites` and the final state of the document) instead of three
            // (one with `hasPendingWrites`, the modified document with
            // `hasPendingWrites` and the final state of the document).
            return t.hasLocalMutations && e.hasCommittedMutations && !e.hasLocalMutations;
        }
        /**
         * Updates the view with the given ViewDocumentChanges and optionally updates
         * limbo docs and sync state from the provided target change.
         * @param docChanges - The set of changes to make to the view's docs.
         * @param updateLimboDocuments - Whether to update limbo documents based on
         *        this change.
         * @param targetChange - A target change to apply for computing limbo docs and
         *        sync state.
         * @returns A new ViewChange with the given docs, changes, and sync state.
         */
        // PORTING NOTE: The iOS/Android clients always compute limbo document changes.
        applyChanges(t, e, n) {
            const s = this.Gu;
            this.Gu = t.Gu, this.mutatedKeys = t.mutatedKeys;
            // Sort changes based on type and query comparator
            const i = t.Wu.Eu();
            i.sort(((t, e) => function(t, e) {
                const n = t => {
                    switch (t) {
                      case 0 /* Added */ :
                        return 1;

                      case 2 /* Modified */ :
                      case 3 /* Metadata */ :
                        // A metadata change is converted to a modified change at the public
                        // api layer.  Since we sort by document key and then change type,
                        // metadata and modified changes must be sorted equivalently.
                        return 2;

                      case 1 /* Removed */ :
                        return 0;

                      default:
                        return k();
                    }
                };
                return n(t) - n(e);
            }
            /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */ (t.type, e.type) || this.Ku(t.doc, e.doc))), this.Hu(n);
            const r = e ? this.Ju() : [], o = 0 === this.qu.size && this.current ? 1 /* Synced */ : 0 /* Local */ , u = o !== this.Uu;
            if (this.Uu = o, 0 !== i.length || u) {
                return {
                    snapshot: new $u(this.query, t.Gu, s, i, t.mutatedKeys, 0 /* Local */ === o, u, 
                    /* excludesMetadataChanges= */ !1),
                    Yu: r
                };
            }
            // no changes
            return {
                Yu: r
            };
        }
        /**
         * Applies an OnlineState change to the view, potentially generating a
         * ViewChange if the view's syncState changes as a result.
         */    bu(t) {
            return this.current && "Offline" /* Offline */ === t ? (
            // If we're offline, set `current` to false and then call applyChanges()
            // to refresh our syncState and generate a ViewChange as appropriate. We
            // are guaranteed to get a new TargetChange that sets `current` back to
            // true once the client is back online.
            this.current = !1, this.applyChanges({
                Gu: this.Gu,
                Wu: new Fu,
                mutatedKeys: this.mutatedKeys,
                $i: !1
            }, 
            /* updateLimboDocuments= */ !1)) : {
                Yu: []
            };
        }
        /**
         * Returns whether the doc for the given key should be in limbo.
         */    Xu(t) {
            // If the remote end says it's part of this query, it's not in limbo.
            return !this.Lu.has(t) && (
            // The local store doesn't think it's a result, so it shouldn't be in limbo.
            !!this.Gu.has(t) && !this.Gu.get(t).hasLocalMutations);
        }
        /**
         * Updates syncedDocuments, current, and limbo docs based on the given change.
         * Returns the list of changes to which docs are in limbo.
         */    Hu(t) {
            t && (t.addedDocuments.forEach((t => this.Lu = this.Lu.add(t))), t.modifiedDocuments.forEach((t => {})), 
            t.removedDocuments.forEach((t => this.Lu = this.Lu.delete(t))), this.current = t.current);
        }
        Ju() {
            // We can only determine limbo documents when we're in-sync with the server.
            if (!this.current) return [];
            // TODO(klimt): Do this incrementally so that it's not quadratic when
            // updating many documents.
                    const t = this.qu;
            this.qu = ls(), this.Gu.forEach((t => {
                this.Xu(t.key) && (this.qu = this.qu.add(t.key));
            }));
            // Diff the new limbo docs with the old limbo docs.
            const e = [];
            return t.forEach((t => {
                this.qu.has(t) || e.push(new Xu(t));
            })), this.qu.forEach((n => {
                t.has(n) || e.push(new Yu(n));
            })), e;
        }
        /**
         * Update the in-memory state of the current view with the state read from
         * persistence.
         *
         * We update the query view whenever a client's primary status changes:
         * - When a client transitions from primary to secondary, it can miss
         *   LocalStorage updates and its query views may temporarily not be
         *   synchronized with the state on disk.
         * - For secondary to primary transitions, the client needs to update the list
         *   of `syncedDocuments` since secondary clients update their query views
         *   based purely on synthesized RemoteEvents.
         *
         * @param queryResult.documents - The documents that match the query according
         * to the LocalStore.
         * @param queryResult.remoteKeys - The keys of the documents that match the
         * query according to the backend.
         *
         * @returns The ViewChange that resulted from this synchronization.
         */
        // PORTING NOTE: Multi-tab only.
        Zu(t) {
            this.Lu = t.Hi, this.qu = ls();
            const e = this.ju(t.documents);
            return this.applyChanges(e, /*updateLimboDocuments=*/ !0);
        }
        /**
         * Returns a view snapshot as if this query was just listened to. Contains
         * a document add for every existing document and the `fromCache` and
         * `hasPendingWrites` status of the already established view.
         */
        // PORTING NOTE: Multi-tab only.
        tc() {
            return $u.fromInitialDocuments(this.query, this.Gu, this.mutatedKeys, 0 /* Local */ === this.Uu);
        }
    }

    /**
     * QueryView contains all of the data that SyncEngine needs to keep track of for
     * a particular query.
     */
    class tc {
        constructor(
        /**
         * The query itself.
         */
        t, 
        /**
         * The target number created by the client that is used in the watch
         * stream to identify this query.
         */
        e, 
        /**
         * The view is responsible for computing the final merged truth of what
         * docs are in the query. It gets notified of local and remote changes,
         * and applies the query filters and limits to determine the most correct
         * possible results.
         */
        n) {
            this.query = t, this.targetId = e, this.view = n;
        }
    }

    /** Tracks a limbo resolution. */ class ec {
        constructor(t) {
            this.key = t, 
            /**
             * Set to true once we've received a document. This is used in
             * getRemoteKeysForTarget() and ultimately used by WatchChangeAggregator to
             * decide whether it needs to manufacture a delete event for the target once
             * the target is CURRENT.
             */
            this.ec = !1;
        }
    }

    /**
     * An implementation of `SyncEngine` coordinating with other parts of SDK.
     *
     * The parts of SyncEngine that act as a callback to RemoteStore need to be
     * registered individually. This is done in `syncEngineWrite()` and
     * `syncEngineListen()` (as well as `applyPrimaryState()`) as these methods
     * serve as entry points to RemoteStore's functionality.
     *
     * Note: some field defined in this class might have public access level, but
     * the class is not exported so they are only accessible from this module.
     * This is useful to implement optional features (like bundles) in free
     * functions, such that they are tree-shakeable.
     */ class nc {
        constructor(t, e, n, 
        // PORTING NOTE: Manages state synchronization in multi-tab environments.
        s, i, r) {
            this.localStore = t, this.remoteStore = e, this.eventManager = n, this.sharedClientState = s, 
            this.currentUser = i, this.maxConcurrentLimboResolutions = r, this.nc = {}, this.sc = new ts((t => hn(t)), an), 
            this.ic = new Map, 
            /**
             * The keys of documents that are in limbo for which we haven't yet started a
             * limbo resolution query. The strings in this set are the result of calling
             * `key.path.canonicalString()` where `key` is a `DocumentKey` object.
             *
             * The `Set` type was chosen because it provides efficient lookup and removal
             * of arbitrary elements and it also maintains insertion order, providing the
             * desired queue-like FIFO semantics.
             */
            this.rc = new Set, 
            /**
             * Keeps track of the target ID for each document that is in limbo with an
             * active target.
             */
            this.oc = new $t(ut.comparator), 
            /**
             * Keeps track of the information about an active limbo resolution for each
             * active target ID that was started for the purpose of limbo resolution.
             */
            this.uc = new Map, this.cc = new to, 
            /** Stores user completion handlers, indexed by User and BatchId. */
            this.ac = {}, 
            /** Stores user callbacks waiting for all pending writes to be acknowledged. */
            this.hc = new Map, this.lc = Dr.vn(), this.onlineState = "Unknown" /* Unknown */ , 
            // The primary state is set to `true` or `false` immediately after Firestore
            // startup. In the interim, a client should only be considered primary if
            // `isPrimary` is true.
            this.fc = void 0;
        }
        get isPrimaryClient() {
            return !0 === this.fc;
        }
    }

    /**
     * Initiates the new listen, resolves promise when listen enqueued to the
     * server. All the subsequent view snapshots or errors are sent to the
     * subscribed handlers. Returns the initial snapshot.
     */
    async function sc(t, e) {
        const n = xc(t);
        let s, i;
        const r = n.sc.get(e);
        if (r) 
        // PORTING NOTE: With Multi-Tab Web, it is possible that a query view
        // already exists when EventManager calls us for the first time. This
        // happens when the primary tab is already listening to this query on
        // behalf of another tab and the user of the primary also starts listening
        // to the query. EventManager will not have an assigned target ID in this
        // case and calls `listen` to obtain this ID.
        s = r.targetId, n.sharedClientState.addLocalQueryTarget(s), i = r.view.tc(); else {
            const t = await vo(n.localStore, un(e));
            n.isPrimaryClient && cu(n.remoteStore, t);
            const r = n.sharedClientState.addLocalQueryTarget(t.targetId);
            s = t.targetId, i = await ic(n, e, s, "current" === r);
        }
        return i;
    }

    /**
     * Registers a view for a previously unknown query and computes its initial
     * snapshot.
     */ async function ic(t, e, n, s) {
        // PORTING NOTE: On Web only, we inject the code that registers new Limbo
        // targets based on view changes. This allows us to only depend on Limbo
        // changes when user code includes queries.
        t.dc = (e, n, s) => async function(t, e, n, s) {
            let i = e.view.ju(n);
            i.$i && (
            // The query has a limit and some docs were removed, so we need
            // to re-run the query against the local store to make sure we
            // didn't lose any good docs that had been past the limit.
            i = await So(t.localStore, e.query, 
            /* usePreviousResults= */ !1).then((({documents: t}) => e.view.ju(t, i))));
            const r = s && s.targetChanges.get(e.targetId), o = e.view.applyChanges(i, 
            /* updateLimboDocuments= */ t.isPrimaryClient, r);
            return gc(t, e.targetId, o.Yu), o.snapshot;
        }(t, e, n, s);
        const i = await So(t.localStore, e, 
        /* usePreviousResults= */ !0), r = new Zu(e, i.Hi), o = r.ju(i.documents), u = ws.createSynthesizedTargetChangeForCurrentChange(n, s && "Offline" /* Offline */ !== t.onlineState), c = r.applyChanges(o, 
        /* updateLimboDocuments= */ t.isPrimaryClient, u);
        gc(t, n, c.Yu);
        const a = new tc(e, n, r);
        return t.sc.set(e, a), t.ic.has(n) ? t.ic.get(n).push(e) : t.ic.set(n, [ e ]), c.snapshot;
    }

    /** Stops listening to the query. */ async function rc(t, e) {
        const n = F(t), s = n.sc.get(e), i = n.ic.get(s.targetId);
        if (i.length > 1) return n.ic.set(s.targetId, i.filter((t => !an(t, e)))), void n.sc.delete(e);
        // No other queries are mapped to the target, clean up the query and the target.
            if (n.isPrimaryClient) {
            // We need to remove the local query target first to allow us to verify
            // whether any other client is still interested in this target.
            n.sharedClientState.removeLocalQueryTarget(s.targetId);
            n.sharedClientState.isActiveQueryTarget(s.targetId) || await Vo(n.localStore, s.targetId, 
            /*keepPersistedTargetData=*/ !1).then((() => {
                n.sharedClientState.clearQueryState(s.targetId), au(n.remoteStore, s.targetId), 
                wc(n, s.targetId);
            })).catch(Tt);
        } else wc(n, s.targetId), await Vo(n.localStore, s.targetId, 
        /*keepPersistedTargetData=*/ !0);
    }

    /**
     * Initiates the write of local mutation batch which involves adding the
     * writes to the mutation queue, notifying the remote store about new
     * mutations and raising events for any changes this write caused.
     *
     * The promise returned by this call is resolved when the above steps
     * have completed, *not* when the write was acked by the backend. The
     * userCallback is resolved once the write was acked/rejected by the
     * backend (or failed locally for any other reason).
     */ async function oc(t, e, n) {
        const s = Nc(t);
        try {
            const t = await function(t, e) {
                const n = F(t), s = et.now(), i = e.reduce(((t, e) => t.add(e.key)), ls());
                let r, o;
                return n.persistence.runTransaction("Locally write mutations", "readwrite", (t => {
                    // Figure out which keys do not have a remote version in the cache, this
                    // is needed to create the right overlay mutation: if no remote version
                    // presents, we do not need to create overlays as patch mutations.
                    // TODO(Overlay): Is there a better way to determine this? Using the
                    //  document version does not work because local mutations set them back
                    //  to 0.
                    let u = ns(), c = ls();
                    return n.Gi.getEntries(t, i).next((t => {
                        u = t, u.forEach(((t, e) => {
                            e.isValidDocument() || (c = c.add(t));
                        }));
                    })).next((() => n.localDocuments.getOverlayedDocuments(t, u))).next((i => {
                        r = i;
                        // For non-idempotent mutations (such as `FieldValue.increment()`),
                        // we record the base state in a separate patch mutation. This is
                        // later used to guarantee consistent values and prevents flicker
                        // even if the backend sends us an update that already includes our
                        // transform.
                        const o = [];
                        for (const t of e) {
                            const e = Ln(t, r.get(t.key).overlayedDocument);
                            null != e && 
                            // NOTE: The base state should only be applied if there's some
                            // existing document to override, so use a Precondition of
                            // exists=true
                            o.push(new Kn(t.key, e, ve(e.value.mapValue), kn.exists(!0)));
                        }
                        return n.mutationQueue.addMutationBatch(t, s, o, e);
                    })).next((e => {
                        o = e;
                        const s = e.applyToLocalDocumentSet(r, c);
                        return n.documentOverlayCache.saveOverlays(t, e.batchId, s);
                    }));
                })).then((() => ({
                    batchId: o.batchId,
                    changes: rs(r)
                })));
            }(s.localStore, e);
            s.sharedClientState.addPendingMutation(t.batchId), function(t, e, n) {
                let s = t.ac[t.currentUser.toKey()];
                s || (s = new $t(X));
                s = s.insert(e, n), t.ac[t.currentUser.toKey()] = s;
            }
            /**
     * Resolves or rejects the user callback for the given batch and then discards
     * it.
     */ (s, t.batchId, n), await Ic(s, t.changes), await Tu(s.remoteStore);
        } catch (t) {
            // If we can't persist the mutation, we reject the user callback and
            // don't send the mutation. The user can then retry the write.
            const e = Mu(t, "Failed to persist write");
            n.reject(e);
        }
    }

    /**
     * Applies one remote event to the sync engine, notifying any views of the
     * changes, and releasing any pending mutation batches that would become
     * visible because of the snapshot version the remote event contains.
     */ async function uc(t, e) {
        const n = F(t);
        try {
            const t = await Ro(n.localStore, e);
            // Update `receivedDocument` as appropriate for any limbo targets.
                    e.targetChanges.forEach(((t, e) => {
                const s = n.uc.get(e);
                s && (
                // Since this is a limbo resolution lookup, it's for a single document
                // and it could be added, modified, or removed, but not a combination.
                M(t.addedDocuments.size + t.modifiedDocuments.size + t.removedDocuments.size <= 1), 
                t.addedDocuments.size > 0 ? s.ec = !0 : t.modifiedDocuments.size > 0 ? M(s.ec) : t.removedDocuments.size > 0 && (M(s.ec), 
                s.ec = !1));
            })), await Ic(n, t, e);
        } catch (t) {
            await Tt(t);
        }
    }

    /**
     * Applies an OnlineState change to the sync engine and notifies any views of
     * the change.
     */ function cc(t, e, n) {
        const s = F(t);
        // If we are the secondary client, we explicitly ignore the remote store's
        // online state (the local client may go offline, even though the primary
        // tab remains online) and only apply the primary tab's online state from
        // SharedClientState.
            if (s.isPrimaryClient && 0 /* RemoteStore */ === n || !s.isPrimaryClient && 1 /* SharedClientState */ === n) {
            const t = [];
            s.sc.forEach(((n, s) => {
                const i = s.view.bu(e);
                i.snapshot && t.push(i.snapshot);
            })), function(t, e) {
                const n = F(t);
                n.onlineState = e;
                let s = !1;
                n.queries.forEach(((t, n) => {
                    for (const t of n.listeners) 
                    // Run global snapshot listeners if a consistent snapshot has been emitted.
                    t.bu(e) && (s = !0);
                })), s && Qu(n);
            }(s.eventManager, e), t.length && s.nc.Wo(t), s.onlineState = e, s.isPrimaryClient && s.sharedClientState.setOnlineState(e);
        }
    }

    /**
     * Rejects the listen for the given targetID. This can be triggered by the
     * backend for any active target.
     *
     * @param syncEngine - The sync engine implementation.
     * @param targetId - The targetID corresponds to one previously initiated by the
     * user as part of TargetData passed to listen() on RemoteStore.
     * @param err - A description of the condition that has forced the rejection.
     * Nearly always this will be an indication that the user is no longer
     * authorized to see the data matching the target.
     */ async function ac(t, e, n) {
        const s = F(t);
        // PORTING NOTE: Multi-tab only.
            s.sharedClientState.updateQueryState(e, "rejected", n);
        const i = s.uc.get(e), r = i && i.key;
        if (r) {
            // TODO(klimt): We really only should do the following on permission
            // denied errors, but we don't have the cause code here.
            // It's a limbo doc. Create a synthetic event saying it was deleted.
            // This is kind of a hack. Ideally, we would have a method in the local
            // store to purge a document. However, it would be tricky to keep all of
            // the local store's invariants with another method.
            let t = new $t(ut.comparator);
            // TODO(b/217189216): This limbo document should ideally have a read time,
            // so that it is picked up by any read-time based scans. The backend,
            // however, does not send a read time for target removals.
                    t = t.insert(r, Ve.newNoDocument(r, nt.min()));
            const n = ls().add(r), i = new _s(nt.min(), 
            /* targetChanges= */ new Map, 
            /* targetMismatches= */ new Ut(X), t, n);
            await uc(s, i), 
            // Since this query failed, we won't want to manually unlisten to it.
            // We only remove it from bookkeeping after we successfully applied the
            // RemoteEvent. If `applyRemoteEvent()` throws, we want to re-listen to
            // this query when the RemoteStore restarts the Watch stream, which should
            // re-trigger the target failure.
            s.oc = s.oc.remove(r), s.uc.delete(e), pc(s);
        } else await Vo(s.localStore, e, 
        /* keepPersistedTargetData */ !1).then((() => wc(s, e, n))).catch(Tt);
    }

    async function hc(t, e) {
        const n = F(t), s = e.batch.batchId;
        try {
            const t = await Eo(n.localStore, e);
            // The local store may or may not be able to apply the write result and
            // raise events immediately (depending on whether the watcher is caught
            // up), so we raise user callbacks first so that they consistently happen
            // before listen events.
                    _c(n, s, /*error=*/ null), dc(n, s), n.sharedClientState.updateMutationState(s, "acknowledged"), 
            await Ic(n, t);
        } catch (t) {
            await Tt(t);
        }
    }

    async function lc(t, e, n) {
        const s = F(t);
        try {
            const t = await function(t, e) {
                const n = F(t);
                return n.persistence.runTransaction("Reject batch", "readwrite-primary", (t => {
                    let s;
                    return n.mutationQueue.lookupMutationBatch(t, e).next((e => (M(null !== e), s = e.keys(), 
                    n.mutationQueue.removeMutationBatch(t, e)))).next((() => n.mutationQueue.performConsistencyCheck(t))).next((() => n.documentOverlayCache.removeOverlaysForBatchId(t, s, e))).next((() => n.localDocuments.recalculateAndSaveOverlaysForDocumentKeys(t, s))).next((() => n.localDocuments.getDocuments(t, s)));
                }));
            }
            /**
     * Returns the largest (latest) batch id in mutation queue that is pending
     * server response.
     *
     * Returns `BATCHID_UNKNOWN` if the queue is empty.
     */ (s.localStore, e);
            // The local store may or may not be able to apply the write result and
            // raise events immediately (depending on whether the watcher is caught up),
            // so we raise user callbacks first so that they consistently happen before
            // listen events.
                    _c(s, e, n), dc(s, e), s.sharedClientState.updateMutationState(e, "rejected", n), 
            await Ic(s, t);
        } catch (n) {
            await Tt(n);
        }
    }

    /**
     * Triggers the callbacks that are waiting for this batch id to get acknowledged by server,
     * if there are any.
     */ function dc(t, e) {
        (t.hc.get(e) || []).forEach((t => {
            t.resolve();
        })), t.hc.delete(e);
    }

    /** Reject all outstanding callbacks waiting for pending writes to complete. */ function _c(t, e, n) {
        const s = F(t);
        let i = s.ac[s.currentUser.toKey()];
        // NOTE: Mutations restored from persistence won't have callbacks, so it's
        // okay for there to be no callback for this ID.
            if (i) {
            const t = i.get(e);
            t && (n ? t.reject(n) : t.resolve(), i = i.remove(e)), s.ac[s.currentUser.toKey()] = i;
        }
    }

    function wc(t, e, n = null) {
        t.sharedClientState.removeLocalQueryTarget(e);
        for (const s of t.ic.get(e)) t.sc.delete(s), n && t.nc._c(s, n);
        if (t.ic.delete(e), t.isPrimaryClient) {
            t.cc.ls(e).forEach((e => {
                t.cc.containsKey(e) || 
                // We removed the last reference for this key
                mc(t, e);
            }));
        }
    }

    function mc(t, e) {
        t.rc.delete(e.path.canonicalString());
        // It's possible that the target already got removed because the query failed. In that case,
        // the key won't exist in `limboTargetsByKey`. Only do the cleanup if we still have the target.
        const n = t.oc.get(e);
        null !== n && (au(t.remoteStore, n), t.oc = t.oc.remove(e), t.uc.delete(n), pc(t));
    }

    function gc(t, e, n) {
        for (const s of n) if (s instanceof Yu) t.cc.addReference(s.key, e), yc(t, s); else if (s instanceof Xu) {
            D("SyncEngine", "Document no longer in limbo: " + s.key), t.cc.removeReference(s.key, e);
            t.cc.containsKey(s.key) || 
            // We removed the last reference for this key
            mc(t, s.key);
        } else k();
    }

    function yc(t, e) {
        const n = e.key, s = n.path.canonicalString();
        t.oc.get(n) || t.rc.has(s) || (D("SyncEngine", "New document in limbo: " + n), t.rc.add(s), 
        pc(t));
    }

    /**
     * Starts listens for documents in limbo that are enqueued for resolution,
     * subject to a maximum number of concurrent resolutions.
     *
     * Without bounding the number of concurrent resolutions, the server can fail
     * with "resource exhausted" errors which can lead to pathological client
     * behavior as seen in https://github.com/firebase/firebase-js-sdk/issues/2683.
     */ function pc(t) {
        for (;t.rc.size > 0 && t.oc.size < t.maxConcurrentLimboResolutions; ) {
            const e = t.rc.values().next().value;
            t.rc.delete(e);
            const n = new ut(it.fromString(e)), s = t.lc.next();
            t.uc.set(s, new ec(n)), t.oc = t.oc.insert(n, s), cu(t.remoteStore, new Oi(un(tn(n.path)), s, 2 /* LimboResolution */ , kt.at));
        }
    }

    async function Ic(t, e, n) {
        const s = F(t), i = [], r = [], o = [];
        s.sc.isEmpty() || (s.sc.forEach(((t, u) => {
            o.push(s.dc(u, e, n).then((t => {
                if (t) {
                    s.isPrimaryClient && s.sharedClientState.updateQueryState(u.targetId, t.fromCache ? "not-current" : "current"), 
                    i.push(t);
                    const e = go.Ci(u.targetId, t);
                    r.push(e);
                }
            })));
        })), await Promise.all(o), s.nc.Wo(i), await async function(t, e) {
            const n = F(t);
            try {
                await n.persistence.runTransaction("notifyLocalViewChanges", "readwrite", (t => Et.forEach(e, (e => Et.forEach(e.Si, (s => n.persistence.referenceDelegate.addReference(t, e.targetId, s))).next((() => Et.forEach(e.Di, (s => n.persistence.referenceDelegate.removeReference(t, e.targetId, s)))))))));
            } catch (t) {
                if (!vt(t)) throw t;
                // If `notifyLocalViewChanges` fails, we did not advance the sequence
                // number for the documents that were included in this transaction.
                // This might trigger them to be deleted earlier than they otherwise
                // would have, but it should not invalidate the integrity of the data.
                D("LocalStore", "Failed to update sequence numbers: " + t);
            }
            for (const t of e) {
                const e = t.targetId;
                if (!t.fromCache) {
                    const t = n.Ui.get(e), s = t.snapshotVersion, i = t.withLastLimboFreeSnapshotVersion(s);
                    // Advance the last limbo free snapshot version
                                    n.Ui = n.Ui.insert(e, i);
                }
            }
        }(s.localStore, r));
    }

    async function Tc(t, e) {
        const n = F(t);
        if (!n.currentUser.isEqual(e)) {
            D("SyncEngine", "User change. New user:", e.toKey());
            const t = await To(n.localStore, e);
            n.currentUser = e, 
            // Fails tasks waiting for pending writes requested by previous user.
            function(t, e) {
                t.hc.forEach((t => {
                    t.forEach((t => {
                        t.reject(new B($.CANCELLED, e));
                    }));
                })), t.hc.clear();
            }(n, "'waitForPendingWrites' promise is rejected due to a user change."), 
            // TODO(b/114226417): Consider calling this only in the primary tab.
            n.sharedClientState.handleUserChange(e, t.removedBatchIds, t.addedBatchIds), await Ic(n, t.ji);
        }
    }

    function Ec(t, e) {
        const n = F(t), s = n.uc.get(e);
        if (s && s.ec) return ls().add(s.key);
        {
            let t = ls();
            const s = n.ic.get(e);
            if (!s) return t;
            for (const e of s) {
                const s = n.sc.get(e);
                t = t.unionWith(s.view.Qu);
            }
            return t;
        }
    }

    function xc(t) {
        const e = F(t);
        return e.remoteStore.remoteSyncer.applyRemoteEvent = uc.bind(null, e), e.remoteStore.remoteSyncer.getRemoteKeysForTarget = Ec.bind(null, e), 
        e.remoteStore.remoteSyncer.rejectListen = ac.bind(null, e), e.nc.Wo = Ku.bind(null, e.eventManager), 
        e.nc._c = Gu.bind(null, e.eventManager), e;
    }

    function Nc(t) {
        const e = F(t);
        return e.remoteStore.remoteSyncer.applySuccessfulWrite = hc.bind(null, e), e.remoteStore.remoteSyncer.rejectFailedWrite = lc.bind(null, e), 
        e;
    }

    class Mc {
        constructor() {
            this.synchronizeTabs = !1;
        }
        async initialize(t) {
            this.It = Xo(t.databaseInfo.databaseId), this.sharedClientState = this.mc(t), this.persistence = this.gc(t), 
            await this.persistence.start(), this.localStore = this.yc(t), this.gcScheduler = this.Ic(t, this.localStore), 
            this.indexBackfillerScheduler = this.Tc(t, this.localStore);
        }
        Ic(t, e) {
            return null;
        }
        Tc(t, e) {
            return null;
        }
        yc(t) {
            return Io(this.persistence, new yo, t.initialUser, this.It);
        }
        gc(t) {
            return new oo(co.Bs, this.It);
        }
        mc(t) {
            return new Go;
        }
        async terminate() {
            this.gcScheduler && this.gcScheduler.stop(), await this.sharedClientState.shutdown(), 
            await this.persistence.shutdown();
        }
    }

    /**
     * Initializes and wires the components that are needed to interface with the
     * network.
     */ class $c {
        async initialize(t, e) {
            this.localStore || (this.localStore = t.localStore, this.sharedClientState = t.sharedClientState, 
            this.datastore = this.createDatastore(e), this.remoteStore = this.createRemoteStore(e), 
            this.eventManager = this.createEventManager(e), this.syncEngine = this.createSyncEngine(e, 
            /* startAsPrimary=*/ !t.synchronizeTabs), this.sharedClientState.onlineStateHandler = t => cc(this.syncEngine, t, 1 /* SharedClientState */), 
            this.remoteStore.remoteSyncer.handleCredentialChange = Tc.bind(null, this.syncEngine), 
            await Cu(this.remoteStore, this.syncEngine.isPrimaryClient));
        }
        createEventManager(t) {
            return new Lu;
        }
        createDatastore(t) {
            const e = Xo(t.databaseInfo.databaseId), n = (s = t.databaseInfo, new Ho(s));
            var s;
            /** Return the Platform-specific connectivity monitor. */        return function(t, e, n, s) {
                return new su(t, e, n, s);
            }(t.authCredentials, t.appCheckCredentials, n, e);
        }
        createRemoteStore(t) {
            return e = this.localStore, n = this.datastore, s = t.asyncQueue, i = t => cc(this.syncEngine, t, 0 /* RemoteStore */), 
            r = jo.C() ? new jo : new Qo, new ru(e, n, s, i, r);
            var e, n, s, i, r;
            /** Re-enables the network. Idempotent. */    }
        createSyncEngine(t, e) {
            return function(t, e, n, 
            // PORTING NOTE: Manages state synchronization in multi-tab environments.
            s, i, r, o) {
                const u = new nc(t, e, n, s, i, r);
                return o && (u.fc = !0), u;
            }(this.localStore, this.remoteStore, this.eventManager, this.sharedClientState, t.initialUser, t.maxConcurrentLimboResolutions, e);
        }
        terminate() {
            return async function(t) {
                const e = F(t);
                D("RemoteStore", "RemoteStore shutting down."), e._u.add(5 /* Shutdown */), await uu(e), 
                e.mu.shutdown(), 
                // Set the OnlineState to Unknown (rather than Offline) to avoid potentially
                // triggering spurious listener events with cached data, etc.
                e.gu.set("Unknown" /* Unknown */);
            }(this.remoteStore);
        }
    }

    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * On web, a `ReadableStream` is wrapped around by a `ByteStreamReader`.
     */
    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /*
     * A wrapper implementation of Observer<T> that will dispatch events
     * asynchronously. To allow immediate silencing, a mute call is added which
     * causes events scheduled to no longer be raised.
     */
    class Lc {
        constructor(t) {
            this.observer = t, 
            /**
             * When set to true, will not raise future events. Necessary to deal with
             * async detachment of listener.
             */
            this.muted = !1;
        }
        next(t) {
            this.observer.next && this.Ac(this.observer.next, t);
        }
        error(t) {
            this.observer.error ? this.Ac(this.observer.error, t) : C("Uncaught Error in snapshot listener:", t);
        }
        Rc() {
            this.muted = !0;
        }
        Ac(t, e) {
            this.muted || setTimeout((() => {
                this.muted || t(e);
            }), 0);
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * FirestoreClient is a top-level class that constructs and owns all of the
     * pieces of the client SDK architecture. It is responsible for creating the
     * async queue that is shared by all of the other components in the system.
     */
    class Gc {
        constructor(t, e, 
        /**
         * Asynchronous queue responsible for all of our internal processing. When
         * we get incoming work from the user (via public API) or the network
         * (incoming GRPC messages), we should always schedule onto this queue.
         * This ensures all of our work is properly serialized (e.g. we don't
         * start processing a new operation while the previous one is waiting for
         * an async I/O to complete).
         */
        n, s) {
            this.authCredentials = t, this.appCheckCredentials = e, this.asyncQueue = n, this.databaseInfo = s, 
            this.user = b.UNAUTHENTICATED, this.clientId = Y.R(), this.authCredentialListener = () => Promise.resolve(), 
            this.appCheckCredentialListener = () => Promise.resolve(), this.authCredentials.start(n, (async t => {
                D("FirestoreClient", "Received user=", t.uid), await this.authCredentialListener(t), 
                this.user = t;
            })), this.appCheckCredentials.start(n, (t => (D("FirestoreClient", "Received new app check token=", t), 
            this.appCheckCredentialListener(t, this.user))));
        }
        async getConfiguration() {
            return {
                asyncQueue: this.asyncQueue,
                databaseInfo: this.databaseInfo,
                clientId: this.clientId,
                authCredentials: this.authCredentials,
                appCheckCredentials: this.appCheckCredentials,
                initialUser: this.user,
                maxConcurrentLimboResolutions: 100
            };
        }
        setCredentialChangeListener(t) {
            this.authCredentialListener = t;
        }
        setAppCheckTokenChangeListener(t) {
            this.appCheckCredentialListener = t;
        }
        /**
         * Checks that the client has not been terminated. Ensures that other methods on
         * this class cannot be called after the client is terminated.
         */    verifyNotTerminated() {
            if (this.asyncQueue.isShuttingDown) throw new B($.FAILED_PRECONDITION, "The client has already been terminated.");
        }
        terminate() {
            this.asyncQueue.enterRestrictedMode();
            const t = new L;
            return this.asyncQueue.enqueueAndForgetEvenWhileRestricted((async () => {
                try {
                    this.onlineComponents && await this.onlineComponents.terminate(), this.offlineComponents && await this.offlineComponents.terminate(), 
                    // The credentials provider must be terminated after shutting down the
                    // RemoteStore as it will prevent the RemoteStore from retrieving auth
                    // tokens.
                    this.authCredentials.shutdown(), this.appCheckCredentials.shutdown(), t.resolve();
                } catch (e) {
                    const n = Mu(e, "Failed to shutdown persistence");
                    t.reject(n);
                }
            })), t.promise;
        }
    }

    async function Qc(t, e) {
        t.asyncQueue.verifyOperationInProgress(), D("FirestoreClient", "Initializing OfflineComponentProvider");
        const n = await t.getConfiguration();
        await e.initialize(n);
        let s = n.initialUser;
        t.setCredentialChangeListener((async t => {
            s.isEqual(t) || (await To(e.localStore, t), s = t);
        })), 
        // When a user calls clearPersistence() in one client, all other clients
        // need to be terminated to allow the delete to succeed.
        e.persistence.setDatabaseDeletedListener((() => t.terminate())), t.offlineComponents = e;
    }

    async function jc(t, e) {
        t.asyncQueue.verifyOperationInProgress();
        const n = await Wc(t);
        D("FirestoreClient", "Initializing OnlineComponentProvider");
        const s = await t.getConfiguration();
        await e.initialize(n, s), 
        // The CredentialChangeListener of the online component provider takes
        // precedence over the offline component provider.
        t.setCredentialChangeListener((t => Du(e.remoteStore, t))), t.setAppCheckTokenChangeListener(((t, n) => Du(e.remoteStore, n))), 
        t.onlineComponents = e;
    }

    async function Wc(t) {
        return t.offlineComponents || (D("FirestoreClient", "Using default OfflineComponentProvider"), 
        await Qc(t, new Mc)), t.offlineComponents;
    }

    async function zc(t) {
        return t.onlineComponents || (D("FirestoreClient", "Using default OnlineComponentProvider"), 
        await jc(t, new $c)), t.onlineComponents;
    }

    function Xc(t) {
        return zc(t).then((t => t.syncEngine));
    }

    async function Zc(t) {
        const e = await zc(t), n = e.eventManager;
        return n.onListen = sc.bind(null, e.syncEngine), n.onUnlisten = rc.bind(null, e.syncEngine), 
        n;
    }

    const ha = new Map;

    /**
     * An instance map that ensures only one Datastore exists per Firestore
     * instance.
     */
    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    function la(t, e, n) {
        if (!n) throw new B($.INVALID_ARGUMENT, `Function ${t}() cannot be called with an empty ${e}.`);
    }

    /**
     * Validates that two boolean options are not set at the same time.
     * @internal
     */ function fa(t, e, n, s) {
        if (!0 === e && !0 === s) throw new B($.INVALID_ARGUMENT, `${t} and ${n} cannot be used together.`);
    }

    /**
     * Validates that `path` refers to a document (indicated by the fact it contains
     * an even numbers of segments).
     */ function da(t) {
        if (!ut.isDocumentKey(t)) throw new B($.INVALID_ARGUMENT, `Invalid document reference. Document references must have an even number of segments, but ${t} has ${t.length}.`);
    }

    /**
     * Validates that `path` refers to a collection (indicated by the fact it
     * contains an odd numbers of segments).
     */ function _a(t) {
        if (ut.isDocumentKey(t)) throw new B($.INVALID_ARGUMENT, `Invalid collection reference. Collection references must have an odd number of segments, but ${t} has ${t.length}.`);
    }

    /**
     * Returns true if it's a non-null object without a custom prototype
     * (i.e. excludes Array, Date, etc.).
     */
    /** Returns a string describing the type / value of the provided input. */
    function wa(t) {
        if (void 0 === t) return "undefined";
        if (null === t) return "null";
        if ("string" == typeof t) return t.length > 20 && (t = `${t.substring(0, 20)}...`), 
        JSON.stringify(t);
        if ("number" == typeof t || "boolean" == typeof t) return "" + t;
        if ("object" == typeof t) {
            if (t instanceof Array) return "an array";
            {
                const e = 
                /** try to get the constructor name for an object. */
                function(t) {
                    if (t.constructor) return t.constructor.name;
                    return null;
                }
                /**
     * Casts `obj` to `T`, optionally unwrapping Compat types to expose the
     * underlying instance. Throws if  `obj` is not an instance of `T`.
     *
     * This cast is used in the Lite and Full SDK to verify instance types for
     * arguments passed to the public API.
     * @internal
     */ (t);
                return e ? `a custom ${e} object` : "an object";
            }
        }
        return "function" == typeof t ? "a function" : k();
    }

    function ma(t, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    e) {
        if ("_delegate" in t && (
        // Unwrap Compat types
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        t = t._delegate), !(t instanceof e)) {
            if (e.name === t.constructor.name) throw new B($.INVALID_ARGUMENT, "Type does not match the expected instance. Did you pass a reference from a different Firestore SDK?");
            {
                const n = wa(t);
                throw new B($.INVALID_ARGUMENT, `Expected type '${e.name}', but it was: ${n}`);
            }
        }
        return t;
    }

    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    // settings() defaults:
    /**
     * A concrete type describing all the values that can be applied via a
     * user-supplied `FirestoreSettings` object. This is a separate type so that
     * defaults can be supplied and the value can be checked for equality.
     */
    class ya {
        constructor(t) {
            var e;
            if (void 0 === t.host) {
                if (void 0 !== t.ssl) throw new B($.INVALID_ARGUMENT, "Can't provide ssl option if host option is not set");
                this.host = "firestore.googleapis.com", this.ssl = true;
            } else this.host = t.host, this.ssl = null === (e = t.ssl) || void 0 === e || e;
            if (this.credentials = t.credentials, this.ignoreUndefinedProperties = !!t.ignoreUndefinedProperties, 
            void 0 === t.cacheSizeBytes) this.cacheSizeBytes = 41943040; else {
                if (-1 !== t.cacheSizeBytes && t.cacheSizeBytes < 1048576) throw new B($.INVALID_ARGUMENT, "cacheSizeBytes must be at least 1048576");
                this.cacheSizeBytes = t.cacheSizeBytes;
            }
            this.experimentalForceLongPolling = !!t.experimentalForceLongPolling, this.experimentalAutoDetectLongPolling = !!t.experimentalAutoDetectLongPolling, 
            this.useFetchStreams = !!t.useFetchStreams, fa("experimentalForceLongPolling", t.experimentalForceLongPolling, "experimentalAutoDetectLongPolling", t.experimentalAutoDetectLongPolling);
        }
        isEqual(t) {
            return this.host === t.host && this.ssl === t.ssl && this.credentials === t.credentials && this.cacheSizeBytes === t.cacheSizeBytes && this.experimentalForceLongPolling === t.experimentalForceLongPolling && this.experimentalAutoDetectLongPolling === t.experimentalAutoDetectLongPolling && this.ignoreUndefinedProperties === t.ignoreUndefinedProperties && this.useFetchStreams === t.useFetchStreams;
        }
    }

    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * The Cloud Firestore service interface.
     *
     * Do not call this constructor directly. Instead, use {@link getFirestore}.
     */ class pa {
        /** @hideconstructor */
        constructor(t, e, n, s) {
            this._authCredentials = t, this._appCheckCredentials = e, this._databaseId = n, 
            this._app = s, 
            /**
             * Whether it's a Firestore or Firestore Lite instance.
             */
            this.type = "firestore-lite", this._persistenceKey = "(lite)", this._settings = new ya({}), 
            this._settingsFrozen = !1;
        }
        /**
         * The {@link @firebase/app#FirebaseApp} associated with this `Firestore` service
         * instance.
         */    get app() {
            if (!this._app) throw new B($.FAILED_PRECONDITION, "Firestore was not initialized using the Firebase SDK. 'app' is not available");
            return this._app;
        }
        get _initialized() {
            return this._settingsFrozen;
        }
        get _terminated() {
            return void 0 !== this._terminateTask;
        }
        _setSettings(t) {
            if (this._settingsFrozen) throw new B($.FAILED_PRECONDITION, "Firestore has already been started and its settings can no longer be changed. You can only modify settings before calling any other methods on a Firestore object.");
            this._settings = new ya(t), void 0 !== t.credentials && (this._authCredentials = function(t) {
                if (!t) return new q;
                switch (t.type) {
                  case "gapi":
                    const e = t.client;
                    return new j(e, t.sessionIndex || "0", t.iamToken || null, t.authTokenFactory || null);

                  case "provider":
                    return t.client;

                  default:
                    throw new B($.INVALID_ARGUMENT, "makeAuthCredentialsProvider failed due to invalid credential type");
                }
            }(t.credentials));
        }
        _getSettings() {
            return this._settings;
        }
        _freezeSettings() {
            return this._settingsFrozen = !0, this._settings;
        }
        _delete() {
            return this._terminateTask || (this._terminateTask = this._terminate()), this._terminateTask;
        }
        /** Returns a JSON-serializable representation of this `Firestore` instance. */    toJSON() {
            return {
                app: this._app,
                databaseId: this._databaseId,
                settings: this._settings
            };
        }
        /**
         * Terminates all components used by this client. Subclasses can override
         * this method to clean up their own dependencies, but must also call this
         * method.
         *
         * Only ever called once.
         */    _terminate() {
            /**
     * Removes all components associated with the provided instance. Must be called
     * when the `Firestore` instance is terminated.
     */
            return function(t) {
                const e = ha.get(t);
                e && (D("ComponentProvider", "Removing Datastore"), ha.delete(t), e.terminate());
            }(this), Promise.resolve();
        }
    }

    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * A `DocumentReference` refers to a document location in a Firestore database
     * and can be used to write, read, or listen to the location. The document at
     * the referenced location may or may not exist.
     */ class Ta {
        /** @hideconstructor */
        constructor(t, 
        /**
         * If provided, the `FirestoreDataConverter` associated with this instance.
         */
        e, n) {
            this.converter = e, this._key = n, 
            /** The type of this Firestore reference. */
            this.type = "document", this.firestore = t;
        }
        get _path() {
            return this._key.path;
        }
        /**
         * The document's identifier within its collection.
         */    get id() {
            return this._key.path.lastSegment();
        }
        /**
         * A string representing the path of the referenced document (relative
         * to the root of the database).
         */    get path() {
            return this._key.path.canonicalString();
        }
        /**
         * The collection this `DocumentReference` belongs to.
         */    get parent() {
            return new Aa(this.firestore, this.converter, this._key.path.popLast());
        }
        withConverter(t) {
            return new Ta(this.firestore, t, this._key);
        }
    }

    /**
     * A `Query` refers to a query which you can read or listen to. You can also
     * construct refined `Query` objects by adding filters and ordering.
     */ class Ea {
        // This is the lite version of the Query class in the main SDK.
        /** @hideconstructor protected */
        constructor(t, 
        /**
         * If provided, the `FirestoreDataConverter` associated with this instance.
         */
        e, n) {
            this.converter = e, this._query = n, 
            /** The type of this Firestore reference. */
            this.type = "query", this.firestore = t;
        }
        withConverter(t) {
            return new Ea(this.firestore, t, this._query);
        }
    }

    /**
     * A `CollectionReference` object can be used for adding documents, getting
     * document references, and querying for documents (using {@link query}).
     */ class Aa extends Ea {
        /** @hideconstructor */
        constructor(t, e, n) {
            super(t, e, tn(n)), this._path = n, 
            /** The type of this Firestore reference. */
            this.type = "collection";
        }
        /** The collection's identifier. */    get id() {
            return this._query.path.lastSegment();
        }
        /**
         * A string representing the path of the referenced collection (relative
         * to the root of the database).
         */    get path() {
            return this._query.path.canonicalString();
        }
        /**
         * A reference to the containing `DocumentReference` if this is a
         * subcollection. If this isn't a subcollection, the reference is null.
         */    get parent() {
            const t = this._path.popLast();
            return t.isEmpty() ? null : new Ta(this.firestore, 
            /* converter= */ null, new ut(t));
        }
        withConverter(t) {
            return new Aa(this.firestore, t, this._path);
        }
    }

    function Ra(t, e, ...n) {
        if (t = getModularInstance(t), la("collection", "path", e), t instanceof pa) {
            const s = it.fromString(e, ...n);
            return _a(s), new Aa(t, /* converter= */ null, s);
        }
        {
            if (!(t instanceof Ta || t instanceof Aa)) throw new B($.INVALID_ARGUMENT, "Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore");
            const s = t._path.child(it.fromString(e, ...n));
            return _a(s), new Aa(t.firestore, 
            /* converter= */ null, s);
        }
    }

    function Pa(t, e, ...n) {
        if (t = getModularInstance(t), 
        // We allow omission of 'pathString' but explicitly prohibit passing in both
        // 'undefined' and 'null'.
        1 === arguments.length && (e = Y.R()), la("doc", "path", e), t instanceof pa) {
            const s = it.fromString(e, ...n);
            return da(s), new Ta(t, 
            /* converter= */ null, new ut(s));
        }
        {
            if (!(t instanceof Ta || t instanceof Aa)) throw new B($.INVALID_ARGUMENT, "Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore");
            const s = t._path.child(it.fromString(e, ...n));
            return da(s), new Ta(t.firestore, t instanceof Aa ? t.converter : null, new ut(s));
        }
    }

    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */ class Sa {
        constructor() {
            // The last promise in the queue.
            this.$c = Promise.resolve(), 
            // A list of retryable operations. Retryable operations are run in order and
            // retried with backoff.
            this.Bc = [], 
            // Is this AsyncQueue being shut down? Once it is set to true, it will not
            // be changed again.
            this.Lc = !1, 
            // Operations scheduled to be queued in the future. Operations are
            // automatically removed after they are run or canceled.
            this.Uc = [], 
            // visible for testing
            this.qc = null, 
            // Flag set while there's an outstanding AsyncQueue operation, used for
            // assertion sanity-checks.
            this.Kc = !1, 
            // Enabled during shutdown on Safari to prevent future access to IndexedDB.
            this.Gc = !1, 
            // List of TimerIds to fast-forward delays for.
            this.Qc = [], 
            // Backoff timer used to schedule retries for retryable operations
            this.xo = new Zo(this, "async_queue_retry" /* AsyncQueueRetry */), 
            // Visibility handler that triggers an immediate retry of all retryable
            // operations. Meant to speed up recovery when we regain file system access
            // after page comes into foreground.
            this.jc = () => {
                const t = Yo();
                t && D("AsyncQueue", "Visibility state changed to " + t.visibilityState), this.xo.bo();
            };
            const t = Yo();
            t && "function" == typeof t.addEventListener && t.addEventListener("visibilitychange", this.jc);
        }
        get isShuttingDown() {
            return this.Lc;
        }
        /**
         * Adds a new operation to the queue without waiting for it to complete (i.e.
         * we ignore the Promise result).
         */    enqueueAndForget(t) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.enqueue(t);
        }
        enqueueAndForgetEvenWhileRestricted(t) {
            this.Wc(), 
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.zc(t);
        }
        enterRestrictedMode(t) {
            if (!this.Lc) {
                this.Lc = !0, this.Gc = t || !1;
                const e = Yo();
                e && "function" == typeof e.removeEventListener && e.removeEventListener("visibilitychange", this.jc);
            }
        }
        enqueue(t) {
            if (this.Wc(), this.Lc) 
            // Return a Promise which never resolves.
            return new Promise((() => {}));
            // Create a deferred Promise that we can return to the callee. This
            // allows us to return a "hanging Promise" only to the callee and still
            // advance the queue even when the operation is not run.
                    const e = new L;
            return this.zc((() => this.Lc && this.Gc ? Promise.resolve() : (t().then(e.resolve, e.reject), 
            e.promise))).then((() => e.promise));
        }
        enqueueRetryable(t) {
            this.enqueueAndForget((() => (this.Bc.push(t), this.Hc())));
        }
        /**
         * Runs the next operation from the retryable queue. If the operation fails,
         * reschedules with backoff.
         */    async Hc() {
            if (0 !== this.Bc.length) {
                try {
                    await this.Bc[0](), this.Bc.shift(), this.xo.reset();
                } catch (t) {
                    if (!vt(t)) throw t;
     // Failure will be handled by AsyncQueue
                                    D("AsyncQueue", "Operation failed with retryable error: " + t);
                }
                this.Bc.length > 0 && 
                // If there are additional operations, we re-schedule `retryNextOp()`.
                // This is necessary to run retryable operations that failed during
                // their initial attempt since we don't know whether they are already
                // enqueued. If, for example, `op1`, `op2`, `op3` are enqueued and `op1`
                // needs to  be re-run, we will run `op1`, `op1`, `op2` using the
                // already enqueued calls to `retryNextOp()`. `op3()` will then run in the
                // call scheduled here.
                // Since `backoffAndRun()` cancels an existing backoff and schedules a
                // new backoff on every call, there is only ever a single additional
                // operation in the queue.
                this.xo.Ao((() => this.Hc()));
            }
        }
        zc(t) {
            const e = this.$c.then((() => (this.Kc = !0, t().catch((t => {
                this.qc = t, this.Kc = !1;
                const e = 
                /**
     * Chrome includes Error.message in Error.stack. Other browsers do not.
     * This returns expected output of message + stack when available.
     * @param error - Error or FirestoreError
     */
                function(t) {
                    let e = t.message || "";
                    t.stack && (e = t.stack.includes(t.message) ? t.stack : t.message + "\n" + t.stack);
                    return e;
                }
                /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */ (t);
                // Re-throw the error so that this.tail becomes a rejected Promise and
                // all further attempts to chain (via .then) will just short-circuit
                // and return the rejected Promise.
                throw C("INTERNAL UNHANDLED ERROR: ", e), t;
            })).then((t => (this.Kc = !1, t))))));
            return this.$c = e, e;
        }
        enqueueAfterDelay(t, e, n) {
            this.Wc(), 
            // Fast-forward delays for timerIds that have been overriden.
            this.Qc.indexOf(t) > -1 && (e = 0);
            const s = ku.createAndSchedule(this, t, e, n, (t => this.Jc(t)));
            return this.Uc.push(s), s;
        }
        Wc() {
            this.qc && k();
        }
        verifyOperationInProgress() {}
        /**
         * Waits until all currently queued tasks are finished executing. Delayed
         * operations are not run.
         */    async Yc() {
            // Operations in the queue prior to draining may have enqueued additional
            // operations. Keep draining the queue until the tail is no longer advanced,
            // which indicates that no more new operations were enqueued and that all
            // operations were executed.
            let t;
            do {
                t = this.$c, await t;
            } while (t !== this.$c);
        }
        /**
         * For Tests: Determine if a delayed operation with a particular TimerId
         * exists.
         */    Xc(t) {
            for (const e of this.Uc) if (e.timerId === t) return !0;
            return !1;
        }
        /**
         * For Tests: Runs some or all delayed operations early.
         *
         * @param lastTimerId - Delayed operations up to and including this TimerId
         * will be drained. Pass TimerId.All to run all delayed operations.
         * @returns a Promise that resolves once all operations have been run.
         */    Zc(t) {
            // Note that draining may generate more delayed ops, so we do that first.
            return this.Yc().then((() => {
                // Run ops in the same order they'd run if they ran naturally.
                this.Uc.sort(((t, e) => t.targetTimeMs - e.targetTimeMs));
                for (const e of this.Uc) if (e.skipDelay(), "all" /* All */ !== t && e.timerId === t) break;
                return this.Yc();
            }));
        }
        /**
         * For Tests: Skip all subsequent delays for a timer id.
         */    ta(t) {
            this.Qc.push(t);
        }
        /** Called once a DelayedOperation is run or canceled. */    Jc(t) {
            // NOTE: indexOf / slice are O(n), but delayedOperations is expected to be small.
            const e = this.Uc.indexOf(t);
            this.Uc.splice(e, 1);
        }
    }

    function Da(t) {
        /**
     * Returns true if obj is an object and contains at least one of the specified
     * methods.
     */
        return function(t, e) {
            if ("object" != typeof t || null === t) return !1;
            const n = t;
            for (const t of e) if (t in n && "function" == typeof n[t]) return !0;
            return !1;
        }
        /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
        /**
     * Represents the task of loading a Firestore bundle. It provides progress of bundle
     * loading, as well as task completion and error events.
     *
     * The API is compatible with `Promise<LoadBundleTaskProgress>`.
     */ (t, [ "next", "error", "complete" ]);
    }

    /**
     * The Cloud Firestore service interface.
     *
     * Do not call this constructor directly. Instead, use {@link getFirestore}.
     */
    class Na extends pa {
        /** @hideconstructor */
        constructor(t, e, n, s) {
            super(t, e, n, s), 
            /**
             * Whether it's a {@link Firestore} or Firestore Lite instance.
             */
            this.type = "firestore", this._queue = new Sa, this._persistenceKey = (null == s ? void 0 : s.name) || "[DEFAULT]";
        }
        _terminate() {
            return this._firestoreClient || 
            // The client must be initialized to ensure that all subsequent API
            // usage throws an exception.
            Fa(this), this._firestoreClient.terminate();
        }
    }

    function Ma(e, n) {
        const s = "object" == typeof e ? e : getApp(), i = "string" == typeof e ? e : n || "(default)";
        return _getProvider(s, "firestore").getImmediate({
            identifier: i
        });
    }

    /**
     * @internal
     */ function Oa(t) {
        return t._firestoreClient || Fa(t), t._firestoreClient.verifyNotTerminated(), t._firestoreClient;
    }

    function Fa(t) {
        var e;
        const n = t._freezeSettings(), s = function(t, e, n, s) {
            return new te(t, e, n, s.host, s.ssl, s.experimentalForceLongPolling, s.experimentalAutoDetectLongPolling, s.useFetchStreams);
        }(t._databaseId, (null === (e = t._app) || void 0 === e ? void 0 : e.options.appId) || "", t._persistenceKey, n);
        t._firestoreClient = new Gc(t._authCredentials, t._appCheckCredentials, t._queue, s);
    }

    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * A `FieldPath` refers to a field in a document. The path may consist of a
     * single field name (referring to a top-level field in the document), or a
     * list of field names (referring to a nested field in the document).
     *
     * Create a `FieldPath` by providing field names. If more than one field
     * name is provided, the path will point to a nested field in a document.
     */
    class Ha {
        /**
         * Creates a `FieldPath` from the provided field names. If more than one field
         * name is provided, the path will point to a nested field in a document.
         *
         * @param fieldNames - A list of field names.
         */
        constructor(...t) {
            for (let e = 0; e < t.length; ++e) if (0 === t[e].length) throw new B($.INVALID_ARGUMENT, "Invalid field name at argument $(i + 1). Field names must not be empty.");
            this._internalPath = new ot(t);
        }
        /**
         * Returns true if this `FieldPath` is equal to the provided one.
         *
         * @param other - The `FieldPath` to compare against.
         * @returns true if this `FieldPath` is equal to the provided one.
         */    isEqual(t) {
            return this._internalPath.isEqual(t._internalPath);
        }
    }

    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * An immutable object representing an array of bytes.
     */ class Ya {
        /** @hideconstructor */
        constructor(t) {
            this._byteString = t;
        }
        /**
         * Creates a new `Bytes` object from the given Base64 string, converting it to
         * bytes.
         *
         * @param base64 - The Base64 string used to create the `Bytes` object.
         */    static fromBase64String(t) {
            try {
                return new Ya(jt.fromBase64String(t));
            } catch (t) {
                throw new B($.INVALID_ARGUMENT, "Failed to construct data from Base64 string: " + t);
            }
        }
        /**
         * Creates a new `Bytes` object from the given Uint8Array.
         *
         * @param array - The Uint8Array used to create the `Bytes` object.
         */    static fromUint8Array(t) {
            return new Ya(jt.fromUint8Array(t));
        }
        /**
         * Returns the underlying bytes as a Base64-encoded string.
         *
         * @returns The Base64-encoded string created from the `Bytes` object.
         */    toBase64() {
            return this._byteString.toBase64();
        }
        /**
         * Returns the underlying bytes in a new `Uint8Array`.
         *
         * @returns The Uint8Array created from the `Bytes` object.
         */    toUint8Array() {
            return this._byteString.toUint8Array();
        }
        /**
         * Returns a string representation of the `Bytes` object.
         *
         * @returns A string representation of the `Bytes` object.
         */    toString() {
            return "Bytes(base64: " + this.toBase64() + ")";
        }
        /**
         * Returns true if this `Bytes` object is equal to the provided one.
         *
         * @param other - The `Bytes` object to compare against.
         * @returns true if this `Bytes` object is equal to the provided one.
         */    isEqual(t) {
            return this._byteString.isEqual(t._byteString);
        }
    }

    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Sentinel values that can be used when writing document fields with `set()`
     * or `update()`.
     */ class Xa {
        /**
         * @param _methodName - The public API endpoint that returns this class.
         * @hideconstructor
         */
        constructor(t) {
            this._methodName = t;
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * An immutable object representing a geographic location in Firestore. The
     * location is represented as latitude/longitude pair.
     *
     * Latitude values are in the range of [-90, 90].
     * Longitude values are in the range of [-180, 180].
     */ class Za {
        /**
         * Creates a new immutable `GeoPoint` object with the provided latitude and
         * longitude values.
         * @param latitude - The latitude as number between -90 and 90.
         * @param longitude - The longitude as number between -180 and 180.
         */
        constructor(t, e) {
            if (!isFinite(t) || t < -90 || t > 90) throw new B($.INVALID_ARGUMENT, "Latitude must be a number between -90 and 90, but was: " + t);
            if (!isFinite(e) || e < -180 || e > 180) throw new B($.INVALID_ARGUMENT, "Longitude must be a number between -180 and 180, but was: " + e);
            this._lat = t, this._long = e;
        }
        /**
         * The latitude of this `GeoPoint` instance.
         */    get latitude() {
            return this._lat;
        }
        /**
         * The longitude of this `GeoPoint` instance.
         */    get longitude() {
            return this._long;
        }
        /**
         * Returns true if this `GeoPoint` is equal to the provided one.
         *
         * @param other - The `GeoPoint` to compare against.
         * @returns true if this `GeoPoint` is equal to the provided one.
         */    isEqual(t) {
            return this._lat === t._lat && this._long === t._long;
        }
        /** Returns a JSON-serializable representation of this GeoPoint. */    toJSON() {
            return {
                latitude: this._lat,
                longitude: this._long
            };
        }
        /**
         * Actually private to JS consumers of our API, so this function is prefixed
         * with an underscore.
         */    _compareTo(t) {
            return X(this._lat, t._lat) || X(this._long, t._long);
        }
    }

    /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */ const th = /^__.*__$/;

    /** The result of parsing document data (e.g. for a setData call). */ class eh {
        constructor(t, e, n) {
            this.data = t, this.fieldMask = e, this.fieldTransforms = n;
        }
        toMutation(t, e) {
            return null !== this.fieldMask ? new Kn(t, this.data, this.fieldMask, e, this.fieldTransforms) : new qn(t, this.data, e, this.fieldTransforms);
        }
    }

    function sh(t) {
        switch (t) {
          case 0 /* Set */ :
     // fall through
                  case 2 /* MergeSet */ :
     // fall through
                  case 1 /* Update */ :
            return !0;

          case 3 /* Argument */ :
          case 4 /* ArrayArgument */ :
            return !1;

          default:
            throw k();
        }
    }

    /** A "context" object passed around while parsing user data. */ class ih {
        /**
         * Initializes a ParseContext with the given source and path.
         *
         * @param settings - The settings for the parser.
         * @param databaseId - The database ID of the Firestore instance.
         * @param serializer - The serializer to use to generate the Value proto.
         * @param ignoreUndefinedProperties - Whether to ignore undefined properties
         * rather than throw.
         * @param fieldTransforms - A mutable list of field transforms encountered
         * while parsing the data.
         * @param fieldMask - A mutable list of field paths encountered while parsing
         * the data.
         *
         * TODO(b/34871131): We don't support array paths right now, so path can be
         * null to indicate the context represents any location within an array (in
         * which case certain features will not work and errors will be somewhat
         * compromised).
         */
        constructor(t, e, n, s, i, r) {
            this.settings = t, this.databaseId = e, this.It = n, this.ignoreUndefinedProperties = s, 
            // Minor hack: If fieldTransforms is undefined, we assume this is an
            // external call and we need to validate the entire path.
            void 0 === i && this.ea(), this.fieldTransforms = i || [], this.fieldMask = r || [];
        }
        get path() {
            return this.settings.path;
        }
        get na() {
            return this.settings.na;
        }
        /** Returns a new context with the specified settings overwritten. */    sa(t) {
            return new ih(Object.assign(Object.assign({}, this.settings), t), this.databaseId, this.It, this.ignoreUndefinedProperties, this.fieldTransforms, this.fieldMask);
        }
        ia(t) {
            var e;
            const n = null === (e = this.path) || void 0 === e ? void 0 : e.child(t), s = this.sa({
                path: n,
                ra: !1
            });
            return s.oa(t), s;
        }
        ua(t) {
            var e;
            const n = null === (e = this.path) || void 0 === e ? void 0 : e.child(t), s = this.sa({
                path: n,
                ra: !1
            });
            return s.ea(), s;
        }
        ca(t) {
            // TODO(b/34871131): We don't support array paths right now; so make path
            // undefined.
            return this.sa({
                path: void 0,
                ra: !0
            });
        }
        aa(t) {
            return Rh(t, this.settings.methodName, this.settings.ha || !1, this.path, this.settings.la);
        }
        /** Returns 'true' if 'fieldPath' was traversed when creating this context. */    contains(t) {
            return void 0 !== this.fieldMask.find((e => t.isPrefixOf(e))) || void 0 !== this.fieldTransforms.find((e => t.isPrefixOf(e.field)));
        }
        ea() {
            // TODO(b/34871131): Remove null check once we have proper paths for fields
            // within arrays.
            if (this.path) for (let t = 0; t < this.path.length; t++) this.oa(this.path.get(t));
        }
        oa(t) {
            if (0 === t.length) throw this.aa("Document fields must not be empty");
            if (sh(this.na) && th.test(t)) throw this.aa('Document fields cannot begin and end with "__"');
        }
    }

    /**
     * Helper for parsing raw user input (provided via the API) into internal model
     * classes.
     */ class rh {
        constructor(t, e, n) {
            this.databaseId = t, this.ignoreUndefinedProperties = e, this.It = n || Xo(t);
        }
        /** Creates a new top-level parse context. */    fa(t, e, n, s = !1) {
            return new ih({
                na: t,
                methodName: e,
                la: n,
                path: ot.emptyPath(),
                ra: !1,
                ha: s
            }, this.databaseId, this.It, this.ignoreUndefinedProperties);
        }
    }

    function oh(t) {
        const e = t._freezeSettings(), n = Xo(t._databaseId);
        return new rh(t._databaseId, !!e.ignoreUndefinedProperties, n);
    }

    /** Parse document data from a set() call. */ function uh(t, e, n, s, i, r = {}) {
        const o = t.fa(r.merge || r.mergeFields ? 2 /* MergeSet */ : 0 /* Set */ , e, n, i);
        Ih("Data must be an object, but it was:", o, s);
        const u = yh(s, o);
        let c, a;
        if (r.merge) c = new Gt(o.fieldMask), a = o.fieldTransforms; else if (r.mergeFields) {
            const t = [];
            for (const s of r.mergeFields) {
                const i = Th(e, s, n);
                if (!o.contains(i)) throw new B($.INVALID_ARGUMENT, `Field '${i}' is specified in your field mask but missing from your input data.`);
                bh(t, i) || t.push(i);
            }
            c = new Gt(t), a = o.fieldTransforms.filter((t => c.covers(t.field)));
        } else c = null, a = o.fieldTransforms;
        return new eh(new Pe(u), c, a);
    }

    /**
     * Parses user data to Protobuf Values.
     *
     * @param input - Data to be parsed.
     * @param context - A context object representing the current path being parsed,
     * the source of the data being parsed, etc.
     * @returns The parsed value, or null if the value was a FieldValue sentinel
     * that should not be included in the resulting parsed data.
     */ function gh(t, e) {
        if (ph(
        // Unwrap the API type from the Compat SDK. This will return the API type
        // from firestore-exp.
        t = getModularInstance(t))) return Ih("Unsupported field value:", e, t), yh(t, e);
        if (t instanceof Xa) 
        // FieldValues usually parse into transforms (except deleteField())
        // in which case we do not want to include this field in our parsed data
        // (as doing so will overwrite the field directly prior to the transform
        // trying to transform it). So we don't add this location to
        // context.fieldMask and we return null as our parsing result.
        /**
     * "Parses" the provided FieldValueImpl, adding any necessary transforms to
     * context.fieldTransforms.
     */
        return function(t, e) {
            // Sentinels are only supported with writes, and not within arrays.
            if (!sh(e.na)) throw e.aa(`${t._methodName}() can only be used with update() and set()`);
            if (!e.path) throw e.aa(`${t._methodName}() is not currently supported inside arrays`);
            const n = t._toFieldTransform(e);
            n && e.fieldTransforms.push(n);
        }
        /**
     * Helper to parse a scalar value (i.e. not an Object, Array, or FieldValue)
     *
     * @returns The parsed value
     */ (t, e), null;
        if (void 0 === t && e.ignoreUndefinedProperties) 
        // If the input is undefined it can never participate in the fieldMask, so
        // don't handle this below. If `ignoreUndefinedProperties` is false,
        // `parseScalarValue` will reject an undefined value.
        return null;
        if (
        // If context.path is null we are inside an array and we don't support
        // field mask paths more granular than the top-level array.
        e.path && e.fieldMask.push(e.path), t instanceof Array) {
            // TODO(b/34871131): Include the path containing the array in the error
            // message.
            // In the case of IN queries, the parsed data is an array (representing
            // the set of values to be included for the IN query) that may directly
            // contain additional arrays (each representing an individual field
            // value), so we disable this validation.
            if (e.settings.ra && 4 /* ArrayArgument */ !== e.na) throw e.aa("Nested arrays are not supported");
            return function(t, e) {
                const n = [];
                let s = 0;
                for (const i of t) {
                    let t = gh(i, e.ca(s));
                    null == t && (
                    // Just include nulls in the array for fields being replaced with a
                    // sentinel.
                    t = {
                        nullValue: "NULL_VALUE"
                    }), n.push(t), s++;
                }
                return {
                    arrayValue: {
                        values: n
                    }
                };
            }(t, e);
        }
        return function(t, e) {
            if (null === (t = getModularInstance(t))) return {
                nullValue: "NULL_VALUE"
            };
            if ("number" == typeof t) return yn(e.It, t);
            if ("boolean" == typeof t) return {
                booleanValue: t
            };
            if ("string" == typeof t) return {
                stringValue: t
            };
            if (t instanceof Date) {
                const n = et.fromDate(t);
                return {
                    timestampValue: Ps(e.It, n)
                };
            }
            if (t instanceof et) {
                // Firestore backend truncates precision down to microseconds. To ensure
                // offline mode works the same with regards to truncation, perform the
                // truncation immediately without waiting for the backend to do that.
                const n = new et(t.seconds, 1e3 * Math.floor(t.nanoseconds / 1e3));
                return {
                    timestampValue: Ps(e.It, n)
                };
            }
            if (t instanceof Za) return {
                geoPointValue: {
                    latitude: t.latitude,
                    longitude: t.longitude
                }
            };
            if (t instanceof Ya) return {
                bytesValue: vs(e.It, t._byteString)
            };
            if (t instanceof Ta) {
                const n = e.databaseId, s = t.firestore._databaseId;
                if (!s.isEqual(n)) throw e.aa(`Document reference is for database ${s.projectId}/${s.database} but should be for database ${n.projectId}/${n.database}`);
                return {
                    referenceValue: Ds(t.firestore._databaseId || e.databaseId, t._key.path)
                };
            }
            throw e.aa(`Unsupported field value: ${wa(t)}`);
        }
        /**
     * Checks whether an object looks like a JSON object that should be converted
     * into a struct. Normal class/prototype instances are considered to look like
     * JSON objects since they should be converted to a struct value. Arrays, Dates,
     * GeoPoints, etc. are not considered to look like JSON objects since they map
     * to specific FieldValue types other than ObjectValue.
     */ (t, e);
    }

    function yh(t, e) {
        const n = {};
        return Ft(t) ? 
        // If we encounter an empty object, we explicitly add it to the update
        // mask to ensure that the server creates a map entry.
        e.path && e.path.length > 0 && e.fieldMask.push(e.path) : Ot(t, ((t, s) => {
            const i = gh(s, e.ia(t));
            null != i && (n[t] = i);
        })), {
            mapValue: {
                fields: n
            }
        };
    }

    function ph(t) {
        return !("object" != typeof t || null === t || t instanceof Array || t instanceof Date || t instanceof et || t instanceof Za || t instanceof Ya || t instanceof Ta || t instanceof Xa);
    }

    function Ih(t, e, n) {
        if (!ph(n) || !function(t) {
            return "object" == typeof t && null !== t && (Object.getPrototypeOf(t) === Object.prototype || null === Object.getPrototypeOf(t));
        }(n)) {
            const s = wa(n);
            throw "an object" === s ? e.aa(t + " a custom object") : e.aa(t + " " + s);
        }
    }

    /**
     * Helper that calls fromDotSeparatedString() but wraps any error thrown.
     */ function Th(t, e, n) {
        if ((
        // If required, replace the FieldPath Compat class with with the firestore-exp
        // FieldPath.
        e = getModularInstance(e)) instanceof Ha) return e._internalPath;
        if ("string" == typeof e) return Ah(t, e);
        throw Rh("Field path arguments must be of type string or ", t, 
        /* hasConverter= */ !1, 
        /* path= */ void 0, n);
    }

    /**
     * Matches any characters in a field path string that are reserved.
     */ const Eh = new RegExp("[~\\*/\\[\\]]");

    /**
     * Wraps fromDotSeparatedString with an error message about the method that
     * was thrown.
     * @param methodName - The publicly visible method name
     * @param path - The dot-separated string form of a field path which will be
     * split on dots.
     * @param targetDoc - The document against which the field path will be
     * evaluated.
     */ function Ah(t, e, n) {
        if (e.search(Eh) >= 0) throw Rh(`Invalid field path (${e}). Paths must not contain '~', '*', '/', '[', or ']'`, t, 
        /* hasConverter= */ !1, 
        /* path= */ void 0, n);
        try {
            return new Ha(...e.split("."))._internalPath;
        } catch (s) {
            throw Rh(`Invalid field path (${e}). Paths must not be empty, begin with '.', end with '.', or contain '..'`, t, 
            /* hasConverter= */ !1, 
            /* path= */ void 0, n);
        }
    }

    function Rh(t, e, n, s, i) {
        const r = s && !s.isEmpty(), o = void 0 !== i;
        let u = `Function ${e}() called with invalid data`;
        n && (u += " (via `toFirestore()`)"), u += ". ";
        let c = "";
        return (r || o) && (c += " (found", r && (c += ` in field ${s}`), o && (c += ` in document ${i}`), 
        c += ")"), new B($.INVALID_ARGUMENT, u + t + c);
    }

    /** Checks `haystack` if FieldPath `needle` is present. Runs in O(n). */ function bh(t, e) {
        return t.some((t => t.isEqual(e)));
    }

    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * A `DocumentSnapshot` contains data read from a document in your Firestore
     * database. The data can be extracted with `.data()` or `.get(<field>)` to
     * get a specific field.
     *
     * For a `DocumentSnapshot` that points to a non-existing document, any data
     * access will return 'undefined'. You can use the `exists()` method to
     * explicitly verify a document's existence.
     */ class Ph {
        // Note: This class is stripped down version of the DocumentSnapshot in
        // the legacy SDK. The changes are:
        // - No support for SnapshotMetadata.
        // - No support for SnapshotOptions.
        /** @hideconstructor protected */
        constructor(t, e, n, s, i) {
            this._firestore = t, this._userDataWriter = e, this._key = n, this._document = s, 
            this._converter = i;
        }
        /** Property of the `DocumentSnapshot` that provides the document's ID. */    get id() {
            return this._key.path.lastSegment();
        }
        /**
         * The `DocumentReference` for the document included in the `DocumentSnapshot`.
         */    get ref() {
            return new Ta(this._firestore, this._converter, this._key);
        }
        /**
         * Signals whether or not the document at the snapshot's location exists.
         *
         * @returns true if the document exists.
         */    exists() {
            return null !== this._document;
        }
        /**
         * Retrieves all fields in the document as an `Object`. Returns `undefined` if
         * the document doesn't exist.
         *
         * @returns An `Object` containing all fields in the document or `undefined`
         * if the document doesn't exist.
         */    data() {
            if (this._document) {
                if (this._converter) {
                    // We only want to use the converter and create a new DocumentSnapshot
                    // if a converter has been provided.
                    const t = new vh(this._firestore, this._userDataWriter, this._key, this._document, 
                    /* converter= */ null);
                    return this._converter.fromFirestore(t);
                }
                return this._userDataWriter.convertValue(this._document.data.value);
            }
        }
        /**
         * Retrieves the field specified by `fieldPath`. Returns `undefined` if the
         * document or field doesn't exist.
         *
         * @param fieldPath - The path (for example 'foo' or 'foo.bar') to a specific
         * field.
         * @returns The data at the specified field location or undefined if no such
         * field exists in the document.
         */
        // We are using `any` here to avoid an explicit cast by our users.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        get(t) {
            if (this._document) {
                const e = this._document.data.field(Vh("DocumentSnapshot.get", t));
                if (null !== e) return this._userDataWriter.convertValue(e);
            }
        }
    }

    /**
     * A `QueryDocumentSnapshot` contains data read from a document in your
     * Firestore database as part of a query. The document is guaranteed to exist
     * and its data can be extracted with `.data()` or `.get(<field>)` to get a
     * specific field.
     *
     * A `QueryDocumentSnapshot` offers the same API surface as a
     * `DocumentSnapshot`. Since query results contain only existing documents, the
     * `exists` property will always be true and `data()` will never return
     * 'undefined'.
     */ class vh extends Ph {
        /**
         * Retrieves all fields in the document as an `Object`.
         *
         * @override
         * @returns An `Object` containing all fields in the document.
         */
        data() {
            return super.data();
        }
    }

    /**
     * Helper that calls `fromDotSeparatedString()` but wraps any error thrown.
     */ function Vh(t, e) {
        return "string" == typeof e ? Ah(t, e) : e instanceof Ha ? e._internalPath : e._delegate._internalPath;
    }

    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Metadata about a snapshot, describing the state of the snapshot.
     */ class Sh {
        /** @hideconstructor */
        constructor(t, e) {
            this.hasPendingWrites = t, this.fromCache = e;
        }
        /**
         * Returns true if this `SnapshotMetadata` is equal to the provided one.
         *
         * @param other - The `SnapshotMetadata` to compare against.
         * @returns true if this `SnapshotMetadata` is equal to the provided one.
         */    isEqual(t) {
            return this.hasPendingWrites === t.hasPendingWrites && this.fromCache === t.fromCache;
        }
    }

    /**
     * A `DocumentSnapshot` contains data read from a document in your Firestore
     * database. The data can be extracted with `.data()` or `.get(<field>)` to
     * get a specific field.
     *
     * For a `DocumentSnapshot` that points to a non-existing document, any data
     * access will return 'undefined'. You can use the `exists()` method to
     * explicitly verify a document's existence.
     */ class Dh extends Ph {
        /** @hideconstructor protected */
        constructor(t, e, n, s, i, r) {
            super(t, e, n, s, r), this._firestore = t, this._firestoreImpl = t, this.metadata = i;
        }
        /**
         * Returns whether or not the data exists. True if the document exists.
         */    exists() {
            return super.exists();
        }
        /**
         * Retrieves all fields in the document as an `Object`. Returns `undefined` if
         * the document doesn't exist.
         *
         * By default, `serverTimestamp()` values that have not yet been
         * set to their final value will be returned as `null`. You can override
         * this by passing an options object.
         *
         * @param options - An options object to configure how data is retrieved from
         * the snapshot (for example the desired behavior for server timestamps that
         * have not yet been set to their final value).
         * @returns An `Object` containing all fields in the document or `undefined` if
         * the document doesn't exist.
         */    data(t = {}) {
            if (this._document) {
                if (this._converter) {
                    // We only want to use the converter and create a new DocumentSnapshot
                    // if a converter has been provided.
                    const e = new Ch(this._firestore, this._userDataWriter, this._key, this._document, this.metadata, 
                    /* converter= */ null);
                    return this._converter.fromFirestore(e, t);
                }
                return this._userDataWriter.convertValue(this._document.data.value, t.serverTimestamps);
            }
        }
        /**
         * Retrieves the field specified by `fieldPath`. Returns `undefined` if the
         * document or field doesn't exist.
         *
         * By default, a `serverTimestamp()` that has not yet been set to
         * its final value will be returned as `null`. You can override this by
         * passing an options object.
         *
         * @param fieldPath - The path (for example 'foo' or 'foo.bar') to a specific
         * field.
         * @param options - An options object to configure how the field is retrieved
         * from the snapshot (for example the desired behavior for server timestamps
         * that have not yet been set to their final value).
         * @returns The data at the specified field location or undefined if no such
         * field exists in the document.
         */
        // We are using `any` here to avoid an explicit cast by our users.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        get(t, e = {}) {
            if (this._document) {
                const n = this._document.data.field(Vh("DocumentSnapshot.get", t));
                if (null !== n) return this._userDataWriter.convertValue(n, e.serverTimestamps);
            }
        }
    }

    /**
     * A `QueryDocumentSnapshot` contains data read from a document in your
     * Firestore database as part of a query. The document is guaranteed to exist
     * and its data can be extracted with `.data()` or `.get(<field>)` to get a
     * specific field.
     *
     * A `QueryDocumentSnapshot` offers the same API surface as a
     * `DocumentSnapshot`. Since query results contain only existing documents, the
     * `exists` property will always be true and `data()` will never return
     * 'undefined'.
     */ class Ch extends Dh {
        /**
         * Retrieves all fields in the document as an `Object`.
         *
         * By default, `serverTimestamp()` values that have not yet been
         * set to their final value will be returned as `null`. You can override
         * this by passing an options object.
         *
         * @override
         * @param options - An options object to configure how data is retrieved from
         * the snapshot (for example the desired behavior for server timestamps that
         * have not yet been set to their final value).
         * @returns An `Object` containing all fields in the document.
         */
        data(t = {}) {
            return super.data(t);
        }
    }

    /**
     * A `QuerySnapshot` contains zero or more `DocumentSnapshot` objects
     * representing the results of a query. The documents can be accessed as an
     * array via the `docs` property or enumerated using the `forEach` method. The
     * number of documents can be determined via the `empty` and `size`
     * properties.
     */ class xh {
        /** @hideconstructor */
        constructor(t, e, n, s) {
            this._firestore = t, this._userDataWriter = e, this._snapshot = s, this.metadata = new Sh(s.hasPendingWrites, s.fromCache), 
            this.query = n;
        }
        /** An array of all the documents in the `QuerySnapshot`. */    get docs() {
            const t = [];
            return this.forEach((e => t.push(e))), t;
        }
        /** The number of documents in the `QuerySnapshot`. */    get size() {
            return this._snapshot.docs.size;
        }
        /** True if there are no documents in the `QuerySnapshot`. */    get empty() {
            return 0 === this.size;
        }
        /**
         * Enumerates all of the documents in the `QuerySnapshot`.
         *
         * @param callback - A callback to be called with a `QueryDocumentSnapshot` for
         * each document in the snapshot.
         * @param thisArg - The `this` binding for the callback.
         */    forEach(t, e) {
            this._snapshot.docs.forEach((n => {
                t.call(e, new Ch(this._firestore, this._userDataWriter, n.key, n, new Sh(this._snapshot.mutatedKeys.has(n.key), this._snapshot.fromCache), this.query.converter));
            }));
        }
        /**
         * Returns an array of the documents changes since the last snapshot. If this
         * is the first snapshot, all documents will be in the list as 'added'
         * changes.
         *
         * @param options - `SnapshotListenOptions` that control whether metadata-only
         * changes (i.e. only `DocumentSnapshot.metadata` changed) should trigger
         * snapshot events.
         */    docChanges(t = {}) {
            const e = !!t.includeMetadataChanges;
            if (e && this._snapshot.excludesMetadataChanges) throw new B($.INVALID_ARGUMENT, "To include metadata changes with your document changes, you must also pass { includeMetadataChanges:true } to onSnapshot().");
            return this._cachedChanges && this._cachedChangesIncludeMetadataChanges === e || (this._cachedChanges = 
            /** Calculates the array of `DocumentChange`s for a given `ViewSnapshot`. */
            function(t, e) {
                if (t._snapshot.oldDocs.isEmpty()) {
                    let e = 0;
                    return t._snapshot.docChanges.map((n => ({
                        type: "added",
                        doc: new Ch(t._firestore, t._userDataWriter, n.doc.key, n.doc, new Sh(t._snapshot.mutatedKeys.has(n.doc.key), t._snapshot.fromCache), t.query.converter),
                        oldIndex: -1,
                        newIndex: e++
                    })));
                }
                {
                    // A `DocumentSet` that is updated incrementally as changes are applied to use
                    // to lookup the index of a document.
                    let n = t._snapshot.oldDocs;
                    return t._snapshot.docChanges.filter((t => e || 3 /* Metadata */ !== t.type)).map((e => {
                        const s = new Ch(t._firestore, t._userDataWriter, e.doc.key, e.doc, new Sh(t._snapshot.mutatedKeys.has(e.doc.key), t._snapshot.fromCache), t.query.converter);
                        let i = -1, r = -1;
                        return 0 /* Added */ !== e.type && (i = n.indexOf(e.doc.key), n = n.delete(e.doc.key)), 
                        1 /* Removed */ !== e.type && (n = n.add(e.doc), r = n.indexOf(e.doc.key)), {
                            type: Nh(e.type),
                            doc: s,
                            oldIndex: i,
                            newIndex: r
                        };
                    }));
                }
            }(this, e), this._cachedChangesIncludeMetadataChanges = e), this._cachedChanges;
        }
    }

    function Nh(t) {
        switch (t) {
          case 0 /* Added */ :
            return "added";

          case 2 /* Modified */ :
          case 3 /* Metadata */ :
            return "modified";

          case 1 /* Removed */ :
            return "removed";

          default:
            return k();
        }
    }

    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */ function Mh(t) {
        if ("L" /* Last */ === t.limitType && 0 === t.explicitOrderBy.length) throw new B($.UNIMPLEMENTED, "limitToLast() queries require specifying at least one orderBy() clause");
    }

    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Converts Firestore's internal types to the JavaScript types that we expose
     * to the user.
     *
     * @internal
     */
    class nl {
        convertValue(t, e = "none") {
            switch (ue(t)) {
              case 0 /* NullValue */ :
                return null;

              case 1 /* BooleanValue */ :
                return t.booleanValue;

              case 2 /* NumberValue */ :
                return Ht(t.integerValue || t.doubleValue);

              case 3 /* TimestampValue */ :
                return this.convertTimestamp(t.timestampValue);

              case 4 /* ServerTimestampValue */ :
                return this.convertServerTimestamp(t, e);

              case 5 /* StringValue */ :
                return t.stringValue;

              case 6 /* BlobValue */ :
                return this.convertBytes(Jt(t.bytesValue));

              case 7 /* RefValue */ :
                return this.convertReference(t.referenceValue);

              case 8 /* GeoPointValue */ :
                return this.convertGeoPoint(t.geoPointValue);

              case 9 /* ArrayValue */ :
                return this.convertArray(t.arrayValue, e);

              case 10 /* ObjectValue */ :
                return this.convertObject(t.mapValue, e);

              default:
                throw k();
            }
        }
        convertObject(t, e) {
            const n = {};
            return Ot(t.fields, ((t, s) => {
                n[t] = this.convertValue(s, e);
            })), n;
        }
        convertGeoPoint(t) {
            return new Za(Ht(t.latitude), Ht(t.longitude));
        }
        convertArray(t, e) {
            return (t.values || []).map((t => this.convertValue(t, e)));
        }
        convertServerTimestamp(t, e) {
            switch (e) {
              case "previous":
                const n = Xt(t);
                return null == n ? null : this.convertValue(n, e);

              case "estimate":
                return this.convertTimestamp(Zt(t));

              default:
                return null;
            }
        }
        convertTimestamp(t) {
            const e = zt(t);
            return new et(e.seconds, e.nanos);
        }
        convertDocumentKey(t, e) {
            const n = it.fromString(t);
            M(si(n));
            const s = new ee(n.get(1), n.get(3)), i = new ut(n.popFirst(5));
            return s.isEqual(e) || 
            // TODO(b/64130202): Somehow support foreign references.
            C(`Document ${i} contains a document reference within a different database (${s.projectId}/${s.database}) which is not supported. It will be treated as a reference in the current database (${e.projectId}/${e.database}) instead.`), 
            i;
        }
    }

    /**
     * @license
     * Copyright 2020 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    /**
     * Converts custom model object of type T into `DocumentData` by applying the
     * converter if it exists.
     *
     * This function is used when converting user objects to `DocumentData`
     * because we want to provide the user with a more specific error message if
     * their `set()` or fails due to invalid data originating from a `toFirestore()`
     * call.
     */ function sl(t, e, n) {
        let s;
        // Cast to `any` in order to satisfy the union type constraint on
        // toFirestore().
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return s = t ? n && (n.merge || n.mergeFields) ? t.toFirestore(e, n) : t.toFirestore(e) : e, 
        s;
    }

    class cl extends nl {
        constructor(t) {
            super(), this.firestore = t;
        }
        convertBytes(t) {
            return new Ya(t);
        }
        convertReference(t) {
            const e = this.convertDocumentKey(t, this.firestore._databaseId);
            return new Ta(this.firestore, /* converter= */ null, e);
        }
    }

    /**
     * Add a new document to specified `CollectionReference` with the given data,
     * assigning it a document ID automatically.
     *
     * @param reference - A reference to the collection to add this document to.
     * @param data - An Object containing the data for the new document.
     * @returns A `Promise` resolved with a `DocumentReference` pointing to the
     * newly created document after it has been written to the backend (Note that it
     * won't resolve while you're offline).
     */ function gl(t, e) {
        const n = ma(t.firestore, Na), s = Pa(t), i = sl(t.converter, e);
        return Il(n, [ uh(oh(t.firestore), "addDoc", s._key, i, null !== t.converter, {}).toMutation(s._key, kn.exists(!1)) ]).then((() => s));
    }

    function yl(t, ...e) {
        var n, s, i;
        t = getModularInstance(t);
        let r = {
            includeMetadataChanges: !1
        }, o = 0;
        "object" != typeof e[o] || Da(e[o]) || (r = e[o], o++);
        const u = {
            includeMetadataChanges: r.includeMetadataChanges
        };
        if (Da(e[o])) {
            const t = e[o];
            e[o] = null === (n = t.next) || void 0 === n ? void 0 : n.bind(t), e[o + 1] = null === (s = t.error) || void 0 === s ? void 0 : s.bind(t), 
            e[o + 2] = null === (i = t.complete) || void 0 === i ? void 0 : i.bind(t);
        }
        let c, a, h;
        if (t instanceof Ta) a = ma(t.firestore, Na), h = tn(t._key.path), c = {
            next: n => {
                e[o] && e[o](Tl(a, t, n));
            },
            error: e[o + 1],
            complete: e[o + 2]
        }; else {
            const n = ma(t, Ea);
            a = ma(n.firestore, Na), h = n._query;
            const s = new cl(a);
            c = {
                next: t => {
                    e[o] && e[o](new xh(a, s, n, t));
                },
                error: e[o + 1],
                complete: e[o + 2]
            }, Mh(t._query);
        }
        return function(t, e, n, s) {
            const i = new Lc(s), r = new ju(e, i, n);
            return t.asyncQueue.enqueueAndForget((async () => Uu(await Zc(t), r))), () => {
                i.Rc(), t.asyncQueue.enqueueAndForget((async () => qu(await Zc(t), r)));
            };
        }(Oa(a), h, u, c);
    }

    /**
     * Locally writes `mutations` on the async queue.
     * @internal
     */ function Il(t, e) {
        return function(t, e) {
            const n = new L;
            return t.asyncQueue.enqueueAndForget((async () => oc(await Xc(t), e, n))), n.promise;
        }(Oa(t), e);
    }

    /**
     * Converts a {@link ViewSnapshot} that contains the single document specified by `ref`
     * to a {@link DocumentSnapshot}.
     */ function Tl(t, e, n) {
        const s = n.docs.get(e._key), i = new cl(t);
        return new Dh(t, i, e._key, s, new Sh(n.hasPendingWrites, n.fromCache), e.converter);
    }

    /**
     * Cloud Firestore
     *
     * @packageDocumentation
     */ !function(t, e = !0) {
        !function(t) {
            P = t;
        }(SDK_VERSION), _registerComponent(new Component("firestore", ((t, {instanceIdentifier: n, options: s}) => {
            const i = t.getProvider("app").getImmediate(), r = new Na(new G(t.getProvider("auth-internal")), new z(t.getProvider("app-check-internal")), function(t, e) {
                if (!Object.prototype.hasOwnProperty.apply(t.options, [ "projectId" ])) throw new B($.INVALID_ARGUMENT, '"projectId" not provided in firebase.initializeApp.');
                return new ee(t.options.projectId, e);
            }
            /**
     * @license
     * Copyright 2017 Google LLC
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     *   http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
            /** Sentinel value that sorts before any Mutation Batch ID. */ (i, n), i);
            return s = Object.assign({
                useFetchStreams: e
            }, s), r._setSettings(s), r;
        }), "PUBLIC").setMultipleInstances(!0)), registerVersion(R, "3.5.0", t), 
        // BUILD_TARGET will be replaced by values like esm5, esm2017, cjs5, etc during the compilation
        registerVersion(R, "3.5.0", "esm2017");
    }();

    /* src/App.svelte generated by Svelte v3.50.1 */
    const file = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[7] = list[i].nome;
    	return child_ctx;
    }

    // (44:2) <FormItem label="Nome" description="Defina o nome da comida">
    function create_default_slot_1(ctx) {
    	let textinput;
    	let updating_value;
    	let current;

    	function textinput_value_binding(value) {
    		/*textinput_value_binding*/ ctx[3](value);
    	}

    	let textinput_props = { placeholder: "nham nham" };

    	if (/*novaComida*/ ctx[1] !== void 0) {
    		textinput_props.value = /*novaComida*/ ctx[1];
    	}

    	textinput = new TextInput({ props: textinput_props, $$inline: true });
    	binding_callbacks.push(() => bind(textinput, 'value', textinput_value_binding));

    	const block = {
    		c: function create() {
    			create_component(textinput.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(textinput, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const textinput_changes = {};

    			if (!updating_value && dirty & /*novaComida*/ 2) {
    				updating_value = true;
    				textinput_changes.value = /*novaComida*/ ctx[1];
    				add_flush_callback(() => updating_value = false);
    			}

    			textinput.$set(textinput_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(textinput.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(textinput.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(textinput, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(44:2) <FormItem label=\\\"Nome\\\" description=\\\"Defina o nome da comida\\\">",
    		ctx
    	});

    	return block;
    }

    // (47:2) <Button on:click={adicionaComida}>
    function create_default_slot(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Adicionar");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(47:2) <Button on:click={adicionaComida}>",
    		ctx
    	});

    	return block;
    }

    // (50:2) {#each comidas as { nome }}
    function create_each_block(ctx) {
    	let li;
    	let t_value = /*nome*/ ctx[7] + "";
    	let t;

    	const block = {
    		c: function create() {
    			li = element("li");
    			t = text(t_value);
    			attr_dev(li, "class", "svelte-7hmdwd");
    			add_location(li, file, 50, 3, 1168);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*comidas*/ 1 && t_value !== (t_value = /*nome*/ ctx[7] + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(50:2) {#each comidas as { nome }}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let aside;
    	let formitem;
    	let t0;
    	let button;
    	let t1;
    	let ul;
    	let current;

    	formitem = new FormItem({
    			props: {
    				label: "Nome",
    				description: "Defina o nome da comida",
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button = new Button({
    			props: {
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button.$on("click", /*adicionaComida*/ ctx[2]);
    	let each_value = /*comidas*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			main = element("main");
    			aside = element("aside");
    			create_component(formitem.$$.fragment);
    			t0 = space();
    			create_component(button.$$.fragment);
    			t1 = space();
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(aside, "class", "svelte-7hmdwd");
    			add_location(aside, file, 42, 1, 914);
    			attr_dev(ul, "class", "svelte-7hmdwd");
    			add_location(ul, file, 48, 1, 1130);
    			attr_dev(main, "class", "svelte-7hmdwd");
    			add_location(main, file, 41, 0, 906);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, aside);
    			mount_component(formitem, aside, null);
    			append_dev(aside, t0);
    			mount_component(button, aside, null);
    			append_dev(main, t1);
    			append_dev(main, ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const formitem_changes = {};

    			if (dirty & /*$$scope, novaComida*/ 1026) {
    				formitem_changes.$$scope = { dirty, ctx };
    			}

    			formitem.$set(formitem_changes);
    			const button_changes = {};

    			if (dirty & /*$$scope*/ 1024) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);

    			if (dirty & /*comidas*/ 1) {
    				each_value = /*comidas*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(formitem.$$.fragment, local);
    			transition_in(button.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(formitem.$$.fragment, local);
    			transition_out(button.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(formitem);
    			destroy_component(button);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);

    	const firebaseConfig = {
    		apiKey: "AIzaSyDX9bLiFbMwbAItbR_YPHGbCcIbOr8kWg0",
    		authDomain: "nham-nham-82311.firebaseapp.com",
    		projectId: "nham-nham-82311",
    		storageBucket: "nham-nham-82311.appspot.com",
    		messagingSenderId: "217495930982",
    		appId: "1:217495930982:web:9467b313ca978fce8045a7"
    	};

    	let comidas = [];
    	initializeApp(firebaseConfig);
    	const db = Ma();
    	const colRef = Ra(db, "comidas");

    	yl(colRef, snapshot => {
    		$$invalidate(0, comidas = []);

    		snapshot.docs.forEach(doc => {
    			comidas.push({ ...doc.data() });
    		});
    	});

    	let novaComida;

    	function adicionaComida() {
    		gl(colRef, { nome: novaComida });
    		$$invalidate(1, novaComida = "");
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function textinput_value_binding(value) {
    		novaComida = value;
    		$$invalidate(1, novaComida);
    	}

    	$$self.$capture_state = () => ({
    		Button,
    		FormItem,
    		TextInput,
    		initializeApp,
    		getFirestore: Ma,
    		collection: Ra,
    		onSnapshot: yl,
    		addDoc: gl,
    		firebaseConfig,
    		comidas,
    		db,
    		colRef,
    		novaComida,
    		adicionaComida
    	});

    	$$self.$inject_state = $$props => {
    		if ('comidas' in $$props) $$invalidate(0, comidas = $$props.comidas);
    		if ('novaComida' in $$props) $$invalidate(1, novaComida = $$props.novaComida);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [comidas, novaComida, adicionaComida, textinput_value_binding];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
